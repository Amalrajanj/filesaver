require('dotenv').config()
const { Telegraf } = require('telegraf')
const bot = new Telegraf(process.env.TOKEN)


//database 

const db = require('./config/connection')
const collection = require('./config/collection')
const saver = require('./database/filesaver')


//DATABASE CONNECTION 
db.connect((err) => {
    if (err) { console.log('error connection db' + err); }
    else { console.log('db connected'); }
})


//BOT

bot.start(async(ctx)=>{

    msg = ctx.message.text
    let msgArray = msg.split(' ')
    console.log(msgArray.length);
    let length = msgArray.length
    msgArray.shift()
    let query = msgArray.join(' ')

    user ={
        first_name:ctx.from.first_name,
        userId:ctx.from.id
    }

    //welcoming message on /start and if there is a query available we can send files

    if(length == 1){
        ctx.reply(`<b>I will store files for you and give sharable links .I can also make the files available for all users</b>`,{
            parse_mode:'HTML',
            reply_markup:{
                inline_keyboard:[
                    [{text:'Search',switch_inline_query:''},{text:'Link',callback_data:'POP'}]
                ]
            }
        })
    }else{
        file = await saver.getFile(query).then((res)=>{
            console.log(res);
            ctx.replyWithDocument(res.file_id,{caption:`<b>${res.caption}</b>`,
            parse_mode:'HTML'})
        })
    }
    //saving user details to the database

    saver.saveUser(user)   
    
})

//DEFINING POP CALLBACK
bot.action('POP',(ctx)=>{
    ctx.deleteMessage()
    ctx.reply('send me a file')
})

//help

bot.command('/help',(ctx)=>{
    ctx.reply(`Hello <b>${ctx.from.first_name}</b> you can send me files and i will store and share link for that file to be used inside telegram\nYou can also use me for searching files contributed by various users\n\n(<code>Consider this as an initial version after fixing certain bugs we will make this bot opensource</code>)`,{
        parse_mode:'HTML',
        reply_markup:{
            inline_keyboard:[
                [{text:'🎲Clone',url:'t.me/filesaverhelp'}]
            ]
        }    
    })
})

//broadcasting message to bot users

bot.command('send',async(ctx)=>{
    msg = ctx.message.text
    let msgArray = msg.split(' ')
    msgArray.shift()
    let text = msgArray.join(' ')

    userDetails = await saver.getUser().then((res)=>{
        n = res.length
        userId = []
        for (i = 0; i < n; i++) {
            userId.push(res[i].userId)
        }

        //broadcasting
        totalBroadCast = 0
        totalFail = []

        //creating function for broadcasting and to know bot user status
        async function broadcast(text) {
            for (const users of userId) {
                try {
                    await bot.telegram.sendMessage(users, String(text))
                } catch (err) {
                    saver.updateUser(users)
                    totalFail.push(users)

                }
            }
            ctx.reply(`<b>✅Total active users :</b>${userId.length - totalFail.length}\n❌<b>Total failed broadcast:</b>${totalFail.length}`,{
                parse_mode:'HTML'
            })

        }
        if (ctx.from.id == process.env.ADMIN) {
            broadcast(text)
        }else{
            ctx.replyWithAnimation('https://media.giphy.com/media/fnuSiwXMTV3zmYDf6k/giphy.gif')
        }

    })
})

//saving documents to db and generating link

bot.on('document',(ctx)=>{
    document = ctx.message.document
    console.log(ctx);
    fileDetails ={
        file_name:document.file_name,
        file_id:document.file_id,
        caption:ctx.message.caption,
        file_size:document.file_size,
        uniqueId:document.file_unique_id
    }
    console.log(fileDetails.caption);
    saver.saveFile(fileDetails)
    ctx.reply(`https://t.me/${process.env.BOTUSERNAME}?start=${document.file_unique_id}`)
})

//checking bot status only for admins 

bot.command('stats',async(ctx)=>{
    stats = await saver.getUser().then((res)=>{
        if(ctx.from.id==process.env.ADMIN){
            ctx.reply(`📊Total user: <b> ${res.length}</b>`,{parse_mode:'HTML'})
        }
        
    })
})


//getting files as inline result

bot.on('inline_query',async(ctx)=>{
    query = ctx.inlineQuery.query
    if(query.length>0){
        let searchResult = saver.getfileInline(query).then((res)=>{
            let result = res.map((item,index)=>{
                return {
                    type:'document',
                    id:item._id,
                    title:item.file_name,
                    document_file_id:item.file_id,
                    caption:item.caption,
                    reply_markup:{
                        inline_keyboard:[
                            [{text:"🔎Search again",switch_inline_query:''}]
                        ]
                    }
                }
            })
           
            ctx.answerInlineQuery(result)
        })
    }else{
        console.log('query not found');
    }
    
})



//heroku config
domain = `${process.env.DOMAIN}.herokuapp.com`
bot.launch({
    webhook:{
       domain:domain,
        port:Number(process.env.PORT)

    }
})

