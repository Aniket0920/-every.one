require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const date = require(__dirname + "/date.js")
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
//const nodemailer = require("nodemailer");
//const cron = require("node-cron");

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

 const toSend = [
  {
    title: `Message 1`,
    message: `This is first messageThis is first messageThis is first messageThis is first messageThis is first message`,
    time: `13:00`
  },
  {
    title: `Message 2`,
    message: `This is first messageThis is first messageThis is first messageThis is first messageThis is first message`,
    time: `13:00`
  }
];

app.get("/mails/:mailID", function(req, res) {
    res.render("mail");
    res.end();
});

app.get("/", function(req, res) {
  res.render("home", {
    toSend: toSend
  });
  res.end();
});

app.get("/login", function(req, res) {
  res.render("login");
});

app.get("/register", function(req, res) {
  res.render("register");
});

app.get("/history", function(req, res) {
  res.render("history", {
    toSend: toSend
  });
});

app.get("/compose", function(req, res) {
  res.render("compose", {
    toSend: toSend
  });
});

app.post("/compose", function(req, res) {
  const date = new Date();
  const hour = date.getHours();
  const min = date.getMinutes();
  const sendTo = req.body.to;
  const cc = req.body.cc;
  const subject = req.body.subject;
  console.log(hour + ":" + min);
  const scheduler = req.body.scheduler;
  let timer = "";

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

  }

  cron.schedule(timer, () => {
    smtpTransport.sendMail(mailOptions, function(err, response){
       if(err) {
         console.log(err);
       } else {
         console.log("Message sent: " + response.message);
         res.redirect("/");
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
