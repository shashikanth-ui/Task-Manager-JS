import express from "express"
import pg from "pg"
import env from "dotenv";
import session from "express-session";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import bcrypt from "bcrypt";

const app = express();
env.config();
const saltRounds = 10;

//EXPRESS SESSION SETUP
app.use(session({
    secret: process.env.EXPRESS_SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 1000 * 60 * 60 * 12 // session saved for 12hrs
    }
}));
app.use(express.urlencoded({ extended:true }));
app.use(express.static("public"));
app.use(passport.initialize());
app.use(passport.session());

//DATABASE SETUP
const db = new pg.Client({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
});
db.connect();


app.get("/",(req,res)=>{
    res.render("index.ejs");
});

app.get("/register",(req,res)=>{
    res.render("register.ejs");
});

app.get("/login",(req,res)=>{
    res.render("login.ejs");
})

app.get("/home",async(req,res)=>{
    if(req.isAuthenticated()){
        const tasks = await db.query("SELECT * FROM tasks WHERE user_id = $1",[req.user.id]);
        res.render("home.ejs",{tasks:tasks.rows});
    }else{
        res.redirect("/login");
    }
})

app.get("/auth/google",passport.authenticate("google",{
    scope:["profile","email"],
}))

app.get("/auth/google/home",passport.authenticate("google",{
    successRedirect: "/home",
    failureRedirect:"/",
}))

app.get("/logout",(req,res)=>{
    req.logout(function (err){
        if(err){
            return console.log(err);
        }else{
            res.redirect("/");
        }
    })
})

app.post("/login",passport.authenticate("local",{
        successRedirect: "/home",
        failureRedirect: "/login",
    })
);

app.post("/register",async (req,res)=>{
    const userEmail = req.body.email;
    const userPassword = req.body.password;
    try {
        const result = await db.query("SELECT * FROM users WHERE email = $1",[userEmail]);
        if(result.rows.length === 0 ){
            bcrypt.hash(userPassword,saltRounds,async(err,hash)=>{
                if(err) return err;
                const userDetails = await db.query("INSERT INTO users (email,password,secret) VALUES ($1,$2,$3) RETURNING *",[userEmail,hash,"local"]);
                console.log(userDetails.rows[0]);
                req.login(userDetails.rows[0],(err)=>{
                    if(err) return  console.log(err);
                    res.redirect("/home")
                });
            });
        }else{
            res.redirect("/login");
        }
    } catch (err) {
        console.log(err);
    }
})

// CRUD OPERATIONS
app.get("/addtask",(req,res)=>{
    res.render("addtask.ejs");
})

app.post("/addtask",async(req,res)=>{
    const heading = req.body.heading;
    const taskInfo = req.body.taskinfo;
    const result = await db.query("INSERT INTO tasks (user_id,task_title,task_info) VALUES($1,$2,$3)RETURNING *",[req.user.id,heading,taskInfo]);
    res.redirect("/home")
})

app.get("/editTask/:id",async(req,res)=>{
    if(req.isAuthenticated()){
        try {
            const taskId = req.params.id;
            const userId = req.user.id;
            const result = await db.query("SELECT * FROM tasks WHERE task_id = $1 AND user_id = $2",[taskId,userId]);
            if(result.rows.length > 0){
                res.render("editTask.ejs",{task:result.rows[0]});
            }else{
                res.redirect("/home");
            }    
        } catch (err) {
            console.log(err);
        }

    }else{
        res.redirect("/");
    }
});

app.post("/editTask/:id",async(req,res)=>{
    if(req.isAuthenticated()){
        const taskId = req.params.id;
        const heading = req.body.heading;
        const taskinfo = req.body.taskinfo;
        const userId = req.user.id;
        try {
            const updation = await db.query("UPDATE tasks SET task_title = $1, task_info = $2 WHERE task_id = $3 AND user_id = $4 RETURNING *",[heading,taskinfo,taskId,userId]);
            console.log("updated info : ",updation.rows[0]);
            res.redirect("/home");
        } catch (err) {
            console.log(err);
        }
    }else{
        res.redirect("/");
    }
});

app.get("/deleteTask/:id",async(req,res)=>{
    if(req.isAuthenticated()){
        const userId = req.user.id;
        const taskId = req.params.id;
        try {
            const result = await db.query("SELECT * FROM tasks WHERE user_id = $1 AND task_id = $2",[userId,taskId]);
            if(result.rows.length > 0 ){
                const deletedInfo = await db.query("DELETE FROM tasks WHERE task_id = $1 AND user_id = $2 RETURNING *",[taskId,userId]);
                console.log("DELETED INFO : ",deletedInfo.rows[0]);
                res.redirect("/home");
            }else{
                res.redirect("/home")
            }
        } catch (err) {
            console.log(err);
        }
    }else{
        res.redirect("/");
    }
});











passport.use("local", new Strategy(
  { usernameField: "email", passwordField: "password" },
  async function verify(email, password, cb) {
    try {
        const result = await db.query("SELECT * FROM users WHERE email = $1",[email]);
        if(result.rows.length === 0){
            return cb("user not found")
        }else{
            bcrypt.compare(password,result.rows[0].password,(err,valid)=>{
                if(err) return cb(err);
                if(valid){
                    return cb(null,result.rows[0])
                }else {
                    return cb(null,false);
                }
            });
        }    
    } catch (err) {
        return cb(err);
    }
}))

passport.use("google", new GoogleStrategy({
    clientID:process.env.GOOGLE_CLIENT_ID,
    clientSecret:process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:process.env.GOOGLE_CALLBACK_URL,
    userProfileURL:process.env.GOOGLE_USER_PROFILE_URL,
},
async(accessToken,refreshToken,profile,cb)=>{
    try {
        const userInfo = await db.query("SELECT * FROM users WHERE email = $1",[profile.email]);
        if((userInfo).rows.length === 0){
            const user = await db.query("INSERT INTO users (email,password,secret) VALUES ($1,$2,$3) RETURNING *",[profile.email,profile.id,"google"]);
            return cb(null,user.rows[0]);
        }else{
            return cb(null,userInfo.rows[0]);
        }
    } catch (err) {
        return cb(err)
    }
}
))


passport.serializeUser((user,cb)=>{cb(null,user);});
passport.deserializeUser((user,cb)=>{cb(null,user);});
//SERVER RUNNING AT LOCALHOST PORT 3000
app.listen(3000,()=>{
    console.log("http://localhost:3000");
});