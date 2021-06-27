require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const nodemailer = require("nodemailer");
const cron = require("node-cron");

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(passport.initialize());
app.use(passport.session());

//const url = process.env.MONGO_URL;

 mongoose.connect("mongodb://localhost:27017/mailDB",
 {useNewUrlParser: true,
 useUnifiedTopology: true,
 useFindAndModify: false
});
mongoose.set("useCreateIndex", true);

const mailSchema = new mongoose.Schema({
  to: String,
  cc: String,
  scheduler: String,
  subject: String,
  content: String,
  time: Array
});

const userSchema = new mongoose.Schema({
  username: String,
  name: String,
  password: String,
  googleId: String,
  mails: [mailSchema]
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const Mail = new mongoose.model("Mail", mailSchema);
const User = new mongoose.model("User",userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

let currMail = {};
let currentUserEmail;

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/mails"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    currentUserEmail = profile.emails[0].value;
    User.findOrCreate({ googleId: profile.id, username: profile.emails[0].value, name: profile.displayName }, function (err, user) {
      return cb(err, user);
    });
  }
));


app.get("/mails/:mailID", async function(req, res) {

  await User.findOne({username: currentUserEmail}, function(err, foundUser) {
    if(err) {
      console.log(err);
    } else {
      if(foundUser) {
        foundUser.mails.forEach(function (mail) {
          if(mail._id == req.params.mailID) {
            console.log(mail);
            currMail = mail;
            res.redirect("/mail");
          }
        });
      }
    }
  });
});

app.get("/mail",async function(req, res) {
  if(!req.isAuthenticated()) {
  await User.findOne({username: currentUserEmail}, function(err, foundUser) {
      if(err) {
        console.log(err);
      } else {
        if(foundUser) {
          const username = foundUser.username.split('@');
          res.render("mail", {
            mails: foundUser.mails,
            username: username[0],
            currMail: currMail
          });
        }
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/", function(req, res) {
  res.render("index");
});

app.get("/auth/google",
  passport.authenticate("google", {scope: ["profile", "email"] })
);

app.get("/auth/google/mails",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function(req, res) {
    res.redirect("/home");
  });

app.get("/home", async function(req, res) {
  res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stal   e=0, post-check=0, pre-check=0');

  if(!req.isAuthenticated()) {
  await User.findOne({username: currentUserEmail}, function(err, foundUser) {
      if(err) {
        console.log(err);
      } else {
        if(foundUser) {
          const username = foundUser.username.split('@');
          res.render("home", {
            mails: foundUser.mails,
            username: username[0]
          });
        }
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/login", function(req, res) {
  res.render("login");
});

app.get("/register", function(req, res) {
  res.render("register");
});

app.get("/history",async function(req, res) {
  if(!req.isAuthenticated()) {
    await User.findOne({username: currentUserEmail}, function(err, foundUser) {
      if(err) {
        console.log(err);
      } else {
        if(foundUser) {
          const username = foundUser.username.split('@');
          res.render("history", {
            mails: foundUser.mails,
            username: username[0]
          });
        }
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/compose",async function(req, res) {
  if(!req.isAuthenticated()) {
  await User.findOne({username: currentUserEmail}, function(err, foundUser) {
      if(err) {
        console.log(err);
      } else {
        if(foundUser) {
          const username = foundUser.username.split('@');
          res.render("compose", {
            mails: foundUser.mails,
            username: username[0]
          });
        }
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.post("/compose",async function(req, res) {
  const date = new Date();
  const hour = date.getHours();
  const min = date.getMinutes();
  const sendTo = req.body.to;
  const cc = req.body.cc;
  const subject = req.body.subject;
  const content = req.body.content;
  const scheduler = req.body.scheduler;
  let timer = "";

  const mail = new Mail ({
    to: sendTo,
    cc: cc,
    scheduler: scheduler,
    subject: subject,
    content: content,
    time: [hour,min]
  });

  await User.findOne({username: currentUserEmail}, function(err, foundUser) {
    foundUser.mails.push(mail);
    foundUser.save();
    res.redirect("/home");
  });

 switch (scheduler) {
    case "Reccurent":
      timer = "30 * * * * *";
      break;
    case "Weekly":
      timer = "* * * * * 1";
      break;
    case "Monthly":
      timer = "* * * 1 * *";
      break;
    case "Yearly":
      timer = "* * * * 12 *";
      break;
    default :
      console.log("Error");
  }

  const smtpTransport = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "every.one.massmailer@gmail.com",
        pass: process.env.PASSWORD
    }
  });

  const mailOptions = {
    to : sendTo,
    subject : subject,
    text: content,
    html: content
  }

  cron.schedule(timer, () => {
    smtpTransport.sendMail(mailOptions, function(err, response){
       if(err) {
         console.log(err);
       } else {
         console.log("Message sent: " + response.message);
         res.redirect("/home");
       }
     });
  });

 });

 app.post("/register", function(req, res) {
   currentUserEmail = req.body.username;
  User.register({username: req.body.username}, req.body.password, function(err, user) {
    if(err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/home");
      });
    }
  });
});

app.post("/login", function(req, res) {
  currentUserEmail = req.body.username;
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, function(err) {
        if(err) {
            console.log(err);
            res.redirect("/login");
        } else {
          passport.authenticate("local")(req, res, function() {
            res.redirect("/home");
          });
        }
    });
});

app.get("/logout", function(req, res) {
  req.logout();
  res.redirect("/");
});

//exports.currMail = currMail;


let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}

app.listen(port, function() {
  console.log("Server Started successfully...");
});
