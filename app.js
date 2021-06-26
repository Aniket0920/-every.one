require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const date = require(__dirname + "/date.js")
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const nodemailer = require("nodemailer");
const cron = require("node-cron");

mongoose.connect("mongodb://localhost:27017/mailDB",
 {useNewUrlParser: true,
 useUnifiedTopology: true,
 useFindAndModify: false
});

const mailSchema = {
  to: String,
  cc: String,
  scheduler: String,
  subject: String,
  content: String,
  time: Array
};

const Mail = mongoose.model("Mail", mailSchema);

let toSend = [];
let currMail = {};

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.get("/mails/:mailID", function(req, res) {
  toSend = req.params.mailID;
  Mail.findOne({_id: req.params.mailID}, function(err, mail) {
    if(err) {
      console.log(err);
    } else {
      currMail.to = mail.to;
      currMail.subject = mail.subject;
      currMail.content = mail.content;
      currMail._id = mail._id;
      res.redirect("/mail");
    }
  });
});

app.get("/mail", function(req, res) {
  Mail.find({}, function(err, mails) {
    if(err) {
      console.log(err);
    } else {
      res.render("mail", {
          mails: mails,
          currMail: currMail
        });
    }
  });
});

app.get("/", function(req, res) {
  res.render("index");
});

app.get("/home", function(req, res) {
  Mail.find({}, function(err, mails) {
    if(err) {
      console.log(err);
    } else {
      res.render("home", {
          mails: mails
        });
    }
  })

});

app.get("/login", function(req, res) {
  res.render("login");
});

app.get("/register", function(req, res) {
  res.render("register");
});

app.get("/history", function(req, res) {
  Mail.find({}, function(err, mails) {
    if(err) {
      console.log(err);
    } else {
      res.render("history", {
          mails: mails
        });
    }
  })
});

app.get("/compose", function(req, res) {
  Mail.find({}, function(err, mails) {
    if(err) {
      console.log(err);
    } else {
      res.render("compose", {
          mails: mails
        });
    }
  });
});

app.post("/compose", function(req, res) {
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
  mail.save(function(err) {
    if(!err) {
      res.redirect("/home");
    }
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
        user: "aa6003@srmist.edu.in",
        pass: process.env.PASSWORD
    }
  });

  const mailOptions = {
    to : sendTo,
    subject : subject,
    text: content
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




let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}

app.listen(port, function() {
  console.log("Server Started successfully...");
});
