const express = require("express");
const app = express();
const path = require("path");
const { Election, Quetion, Option, Voter, Admin, Vote } = require("./models");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const csrf = require("tiny-csrf");

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname + "/public")));
app.set("views", path.join(__dirname, "views"));

// for csrf token
app.use(cookieParser("Important string"));
app.use(csrf("123456789iamasecret987654321look", ["POST", "PUT", "DELETE"]));

//passport js for aurthentication
const passport = require("passport");
const LocalStrategy = require("passport-local");
const connectEnsureLogin = require("connect-ensure-login");
const session = require("express-session");
const bcrypt = require("bcrypt");
const saltRound = 10;

app.use(
  session({
    secret: "my-secret-ket-232423234234234234",
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

passport.use(
  "user-local",
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    (username, password, done) => {
      Admin.findOne({
        where: {
          email: username,
        },
      })
        .then(async (user) => {
          // console.log(user.email);
          if (user) {
            const bool = await bcrypt.compare(password, user.password);
            if (bool) {
              return done(null, user);
            } else {
              return done(null, false, {
                message: "Invalid password",
              });
            }
          } else {
            return done(null, false, {
              message: "With This email user doesn't exists",
            });
          }
        })
        .catch((error) => {
          return done(error);
        });
    }
  )
);

passport.use(
  "voter-local",
  new LocalStrategy(
    {
      usernameField: "voterID", // req body parameter name which we use as a id-password
      passwordField: "password",
    },
    (username, password, done) => {
      console.log(username);
      Voter.findOne({
        where: {
          voterId: username,
        },
      })
        .then(async (user) => {
          console.log(user);
          if (user) {
            const bool = await bcrypt.compare(password, user.password);
            if (bool) {
              return done(null, user);
            } else {
              return done(null, false, {
                message: "Invalid password",
              });
            }
          } else {
            return done(null, false, {
              message: "With This ID voter doesn't exists",
            });
          }
        })
        .catch((error) => {
          return done(error);
        });
    }
  )
);

passport.serializeUser((user, done) => {
  console.log(user);
  console.log("Serialize the user with Id : ", user.id);
  console.log("role", user.role);
  done(null, { id: user.id, role: user.role });
});

passport.deserializeUser((id, done) => {
  if (id.role == "admin") {
    Admin.findByPk(id.id)
      .then((user) => {
        done(null, user);
      })
      .catch((err) => {
        done(err, null);
      });
  } else {
    console.log("role :", id.role);
    Voter.findByPk(id.id)
      .then((user) => {
        done(null, user);
      })
      .catch((err) => {
        done(err, null);
      });
  }
});

//flash
const flash = require("connect-flash");
app.set("views", path.join(__dirname, "views"));
app.use(flash());

// for the flash
app.use(function (req, res, next) {
  const data = req.flash();
  res.locals.messages = data;
  next();
});

app.get("/", async (req, res) => {
  if (req.session.passport && req.user.role === "admin") {
    res.redirect("/listOfElection");
  } else {
    res.render("index", {
      title: "Online Voting App",
      csrfToken: req.csrfToken(),
    });
  }
});

// election end points
app.get(
  "/listOfElection",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    console.log(req.user);
    if (req.user.role == "admin") {
      const ele = await Election.getElection(req.user.id);
      if (req.accepts("html")) {
        res.render("election", {
          ele,
          admin: req.user,
          csrfToken: req.csrfToken(),
        });
      } else {
        res.json({
          ele,
        });
      }
    } else {
      return res.redirect("/");
    }
  }
);

app.post(
  "/addquetion/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    console.log(req.body);
    console.log(req.params.id);
    if (req.user.role == "admin") {
      if (req.body.title.trim().length <= 5) {
        req.flash("error", "Title length must grater than 5");
        return res.redirect(`/election/${req.params.id}/addQuetion`);
      }
      if (req.body.desc.length === 0) {
        req.flash("error", "Description Cann't be empty..");
        return res.redirect(`/election/${req.params.id}/addQuetion`);
      }
      if (req.body.desc.length <= 15) {
        req.flash("error", "Description length must grater than 15");
        return res.redirect(`/election/${req.params.id}/addQuetion`);
      }
      try {
        const Que = await Quetion.addQuetion({
          title: req.body.title,
          description: req.body.desc,
          electionID: req.params.id,
        });
        res.redirect(`/election/${req.params.id}/quetion/${Que.id}/addOptions`);
      } catch (error) {
        console.log(error);
        return res.status(422).json(error);
      }
    } else {
      return res.redirect("/");
    }
  }
);

app.post("/election", connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
  console.log(req.body);
  if (req.user.role == "admin") {
    if (req.body.title.trim().length < 5) {
      req.flash("error", "election name length must grater than 5");
      return res.redirect("/listOfElection");
    }
    if (req.body.url.length === 0) {
      req.flash("error", "Url Cann't be empty..");
      return res.redirect("/listOfElection");
    }
    try {
      await Election.addElection({
        title: req.body.title,
        url: req.body.url,
        adminId: req.user.id,
      });
      res.redirect("/listOfElection");
    } catch (error) {
      console.log(error);
      if (error.name == "SequelizeUniqueConstraintError") {
        error.errors.forEach((e) => {
          if (e.message == "url must be unique") {
            req.flash("error", "Url used before so provide anothor one.");
          }
        });
        return res.redirect("/listOfElection");
      } else {
        return res.status(422).json(error);
      }
    }
  } else {
    return res.redirect("/");
  }
});

app.get(
  "/election/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    if (req.user.role == "admin") {
      console.log(req.params.id);
      try {
        const election = await Election.findByPk(req.params.id);
        const que = await Quetion.getQuetions(req.params.id);
        const voters = await Voter.getVoters(req.params.id);
        if (req.accepts("html")) {
          res.render("display", {
            election,
            que,
            totalVoter: voters.length,
            csrfToken: req.csrfToken(),
          });
        } else {
          res.json({
            election,
            que,
          });
        }
      } catch (err) {
        console.log(err);
        return res.status(422).json(err);
      }
    } else {
      return res.redirect("/");
    }
  }
);

app.get(
  "/election/:id/addQuetion",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    if (req.user.role == "admin") {
      console.log(req.params.id);
      try {
        const election = await Election.findByPk(req.params.id);

        if (election.launch) {
          req.flash("error", "ELection is live so ypu cann't chnage ballot");
          return res.redirect(`/election/${election.id}`);
        }

        const que = await Quetion.getQuetions(req.params.id);
        if (req.accepts("html")) {
          res.render("quetion", {
            election,
            que,
            csrfToken: req.csrfToken(),
          });
        } else {
          res.json({
            election,
            que,
          });
        }
      } catch (err) {
        console.log(err);
        return res.status(422).json(err);
      }
    } else {
      return res.redirect("/");
    }
  }
);

app.get(
  "/election/:eId/quetion/:qId/addOptions",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    if (req.user.role == "admin") {
      const election = await Election.findByPk(req.params.eId);
      const quetion = await Quetion.findByPk(req.params.qId);
      const Options = await Option.getOptions(req.params.qId);
      if (req.accepts("html")) {
        return res.render("options", {
          Options,
          quetion,
          election,
          csrfToken: req.csrfToken(),
        });
      } else {
        res.json({
          Options,
          quetion,
          election,
        });
      }
    } else {
      return res.redirect("/");
    }
  }
);

app.post(
  "/election/:eId/quetion/:qId/addOptions",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    if (req.user.role == "admin") {
      if (req.body.name.length === 0) {
        req.flash("error", "Option value cann't be empty !!!");
        return res.redirect(
          `/election/${req.params.eId}/quetion/${req.params.qId}/addOptions`
        );
      }
      try {
        await Option.addOption({
          optionName: req.body.name,
          queid: req.body.qid,
        });
        res.redirect(
          `/election/${req.params.eId}/quetion/${req.params.qId}/addOptions`
        );
      } catch (err) {
        console.log(err);
        return res.status(422).json(err);
      }
    } else {
      return res.redirect("/");
    }
  }
);

app.delete(
  "/delElection/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    if (req.user.role == "admin") {
      const election = await Election.findByPk(req.params.id);
      if (election.launch === false) {
        console.log("We are delete a election with ID: ", req.params.id);
        try {
          const affectedRow = await Election.remove(req.params.id, req.user.id);
          res.send(affectedRow ? true : false);
        } catch (error) {
          console.log(error);
          return res.status(422).json(error);
        }
      } else {
        req.flash("error", "Election is live so you cann't delete it");
        return res.redirect(`/listOfElection`);
      }
    } else {
      return res.redirect("/");
    }
  }
);

app.delete(
  "/election/:eid/delQuetion/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    if (req.user.role == "admin") {
      console.log("We are delete a quetion with ID: ", req.params.id);
      try {
        const affectedRow = await Quetion.remove(req.params.id);
        res.send(affectedRow ? true : false);
      } catch (error) {
        console.log(error);
        return res.status(422).json(error);
      }
    } else {
      return res.redirect("/");
    }
  }
);

app.delete(
  "/election/:eid/delOption/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    if (req.user.role == "admin") {
      console.log("We are delete a option with ID: ", req.params.id);
      try {
        const affectedRow = await Option.remove(req.params.id);
        res.send(affectedRow ? true : false);
      } catch (error) {
        console.log(error);
        return res.status(422).json(error);
      }
    } else {
      return res.redirect("/");
    }
  }
);

app.post(
  "/modify/election/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    if (req.user.role == "admin") {
      if (req.body.title.trim().length < 5) {
        req.flash("error", "election name length must grater than 5");
        return res.redirect("/listOfElection");
      }
      if (req.body.url.length === 0) {
        req.flash("error", "Url Cann't be empty..");
        return res.redirect("/listOfElection");
      }
      try {
        await Election.updateElection({
          id: req.params.id,
          title: req.body.title,
          url: req.body.url,
          adminId: req.user.id,
        });
        req.flash("success", "Election modified successfully!!!");
        res.redirect("/listOfElection");
      } catch (error) {
        if (error.name == "SequelizeUniqueConstraintError") {
          error.errors.forEach((e) => {
            if (e.message == "url must be unique") {
              req.flash("error", "Url used before so provide anothor one.");
            }
          });
          return res.redirect("/listOfElection");
        } else {
          console.log(error);
          return res.status(422).json(error);
        }
      }
    } else {
      return res.redirect("/");
    }
  }
);

app.post(
  "/modify/:eid/quetion/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    if (req.user.role == "admin") {
      if (req.body.title.trim().length <= 5) {
        req.flash("error", "Title length must grater than 5");
        return res.redirect(`/election/${req.params.eid}/addQuetion`);
      }
      if (req.body.desc.length === 0) {
        req.flash("error", "Description Cann't be empty..");
        return res.redirect(`/election/${req.params.eid}/addQuetion`);
      }
      if (req.body.desc.length <= 15) {
        req.flash("error", "Description length must grater than 15");
        return res.redirect(`/election/${req.params.eid}/addQuetion`);
      }
      try {
        await Quetion.updateQuetion({
          id: req.params.id,
          title: req.body.title,
          description: req.body.desc,
        });
        req.flash("success", "Quetion modified successfully!!!");
        return res.redirect(`/election/${req.params.eid}/addQuetion`);
      } catch (error) {
        console.log(error);
        return res.status(422).json(error);
      }
    } else {
      return res.redirect("/");
    }
  }
);

app.post(
  "/election/:eId/quetion/:qId/option/:id/modify",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    if (req.user.role == "admin") {
      const election = await Election.findByPk(req.params.eId);
      if (req.body.optionName.length === 0) {
        req.flash("error", "Option value cann't be empty !!!");
        return res.redirect(
          `/election/${req.params.eId}/quetion/${req.params.qId}/addOptions`
        );
      }
      if (election.launch === false) {
        try {
          const option = await Option.findByPk(req.params.id);
          const update = await option.updating(req.body.optionName);

          console.log(update);
          req.flash("success", "Option modified successfully!!!");
          res.redirect(
            `/election/${req.params.eId}/quetion/${req.params.qId}/addOptions`
          );
        } catch (error) {
          console.log(error);
          return res.status(422).json(error);
        }
      } else {
        req.flash("error", "Election is live so you cann't modify ballot");
        return res.redirect(`/election/${req.params.eId}`);
      }
    } else {
      return res.redirect("/");
    }
  }
);

app.get(
  "/election/:eid/preview",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    if (req.user.role == "admin") {
      try {
        const election = await Election.findByPk(req.params.eid);
        const quetions = await Quetion.getQuetions(req.params.eid);
        const options = [];

        for (let i = 0; i < quetions.length; i++) {
          const op = await Option.getOptions(quetions[i].id);
          options.push(op);
        }

        res.render("preview", {
          election,
          quetions,
          options,
          csrfToken: req.csrfToken(),
        });
      } catch (error) {
        console.log(error);
        return res.status(422).json(error);
      }
    } else {
      return res.redirect("/");
    }
  }
);

app.get(
  "/election/:eid/voter",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    if (req.user.role == "admin") {
      const voters = await Voter.getVoters(req.params.eid);
      if (req.accepts("html")) {
        res.render("voter", {
          electionID: req.params.eid,
          voters,
          csrfToken: req.csrfToken(),
        });
      } else {
        res.json({
          voters,
        });
      }
    } else {
      return res.redirect("/");
    }
  }
);

app.post(
  "/election/:eid/addvoter",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    if (req.user.role == "admin") {
      if (req.body.voterId.trim().length < 3) {
        req.flash("error", "Voter ID must grater than 2!!");
        return res.redirect(`/election/${req.params.eid}/voter`);
      }
      if (req.body.password.length === 0) {
        req.flash("error", "Password can not be empty !!");
        return res.redirect(`/election/${req.params.eid}/voter`);
      }
      if (req.body.password.length <= 5) {
        req.flash("error", "Password must grater than 5 !!");
        return res.redirect(`/election/${req.params.eid}/voter`);
      }

      const pwd = await bcrypt.hash(req.body.password, saltRound);
      try {
        await Voter.addVoter({
          voterId: req.body.voterId,
          password: pwd,
          electionId: req.params.eid,
        });

        res.redirect(`/election/${req.params.eid}/voter`);
      } catch (error) {
        if (error.name == "SequelizeUniqueConstraintError") {
          error.errors.forEach((e) => {
            if (e.message == "voterId must be unique") {
              req.flash("error", "Voter with this VoterId already exists");
            }
          });
          return res.redirect(`/election/${req.params.eid}/voter`);
        } else {
          console.log(error);
          return res.status(422).json(error);
        }
      }
    } else {
      return res.redirect("/");
    }
  }
);

app.delete(
  "/delVoter/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    if (req.user.role == "admin") {
      console.log("We are delete a Voter with ID: ", req.params.id);
      try {
        const affectedRow = await Voter.remove(req.params.id);
        res.send(affectedRow ? true : false);
      } catch (error) {
        console.log(error);
        return res.status(422).json(error);
      }
    } else {
      return res.redirect("/");
    }
  }
);

app.post(
  "/election/:eid/modify/voter/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    if (req.user.role == "admin") {
      if (req.body.pwd.length === 0) {
        req.flash("error", "Password can not be empty !!");
        return res.redirect(`/election/${req.params.eid}/voter`);
      }
      if (req.body.pwd.length <= 5) {
        req.flash("error", "Password must grater than 5 !!");
        return res.redirect(`/election/${req.params.eid}/voter`);
      }
      try {
        const voter = await Voter.findByPk(req.params.id);
        const pwd = await bcrypt.hash(req.body.pwd, saltRound);

        await voter.updateVoter(pwd);

        req.flash("success", "Voter modified successfully!!!");
        res.redirect(`/election/${req.params.eid}/voter`);
      } catch (error) {
        console.log(error);
        return res.status(422).json(error);
      }
    } else {
      return res.redirect("/");
    }
  }
);

app.get(
  "/election/:eid/launch",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    if (req.user.role == "admin") {
      const election = await Election.findByPk(req.params.eid);
      const quetions = await Quetion.getQuetions(req.params.eid);
      const voters = await Voter.getVoters(req.params.eid);

      if (quetions.length < 2) {
        req.flash("error", "Add A more than two quetion in ballot for launch");
        return res.redirect(`/election/${req.params.eid}`);
      }
      if (voters.length < 3) {
        req.flash("error", "Election must contain more than 2 voter!!");
        return res.redirect(`/election/${req.params.eid}`);
      }

      let bool = false;

      const options = [];

      for (let i = 0; i < quetions.length; i++) {
        const op = await Option.getOptions(quetions[i].id);
        options.push(op);
      }

      for (let i = 0; i < options.length; i++) {
        if (options[i].length < 2) {
          console.log("length : ", options[i].length);
          console.log("options array :", options[i]);
          console.log("i = ", i);
          bool = true;
        }
      }

      if (bool) {
        req.flash(
          "error",
          "Each quetion in ballot must contain more than one option !!"
        );
        return res.redirect(`/election/${req.params.eid}`);
      }

      try {
        console.log(election);
        const ele = await election.launchElection();
        console.log(ele);
        console.log("Helo");
        res.redirect(`/election/${req.params.eid}`);
      } catch (error) {
        console.log(error);
        return res.status(422).json(error);
      }
    } else {
      return res.redirect("/");
    }
  }
);

app.get(
  "/election/:eid/end",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    if (req.user.role == "admin") {
      const election = await Election.findByPk(req.params.eid);
      if (election.launch) {
        try {
          await election.endElection();
          return res.redirect(`/election/${req.params.eid}`);
        } catch (error) {
          console.log(error);
          return res.status(422).json(error);
        }
      } else {
        req.flash("error", "Election is not live yet!! so cann't end election");
        return res.redirect(`/election/${req.params.eid}`);
      }
    } else {
      return res.redirect("/");
    }
  }
);

app.get("/launch/:url", async (req, res) => {
  const election = await Election.findElectionByUrl(req.params.url);
  return res.render("voterlogin", {
    election,
    csrfToken: req.csrfToken(),
  });
});

app.post(
  "/sessionVoter/:url",
  passport.authenticate("voter-local", {
    failureRedirect: "back",
    failureFlash: true,
  }),
  (req, res) => {
    console.log(req.user);
    req.flash("success", "Sign In successfully!!!");
    res.redirect(`/vote/${req.params.url}`);
  }
);

app.get("/vote/:url", async (req, res) => {
  // console.log(req.user.role);
  if (req.user === undefined) {
    req.flash("error", "Please Login First");
    return res.redirect(`/launch/${req.params.url}`);
  }
  if (req.user.role === "voter") {
    const election = await Election.findElectionByUrl(req.params.url);
    if (election.launch === false && election.end === false) {
      req.flash("error", "Election is not live so you can't vote on it.");
      return res.redirect(`/launch/${req.params.url}`);
    }
    try {
      if (req.user.electionId != election.id) {
        req.flash(
          "error",
          "You Can't vote in this election beacuse you didn.t added in this election"
        );
        return res.redirect(`/launch/${req.params.url}`);
      }
      if (req.user.role === "voter") {
        if (req.user.voted === false && election.launch) {
          const quetions = await Quetion.getQuetions(election.id);
          const options = [];

          for (let i = 0; i < quetions.length; i++) {
            const op = await Option.getOptions(quetions[i].id);
            options.push(op);
          }

          return res.render("vote", {
            election,
            quetions,
            options,
            csrfToken: req.csrfToken(),
          });
        } else if (election.end && req.user.voted) {
          const quetions = await Quetion.getQuetions(election.id);
          const optionList = [];
          const Votes = [];
          const quetionId = [];
          const voterVotePerQuetion = [];

          for (let i = 0; i < quetions.length; i++) {
            quetionId.push(quetions[i].id);
            const options = await Option.getOptions(quetions[i].id);
            let optionNames = [];
            const voteArray = [];
            const choise = await Vote.findChoise(
              election.id,
              quetions[i].id,
              req.user.id
            );

            voterVotePerQuetion.push(choise.voteVal);

            for (let j = 0; j < options.length; j++) {
              optionNames.push(options[j].optionName);
              const vote = await Vote.retriveVoteCount(
                options[j].optionName,
                election.id,
                quetions[i].id
              );
              voteArray.push(vote.length);
            }
            optionList.push(optionNames);
            Votes.push(voteArray);
          }

          const votingCount = await Voter.voting(election.id);

          return res.render("resultPage", {
            election,
            quetions,
            quetionId,
            voterVotePerQuetion,
            optionList,
            Votes,
            votingCount: votingCount.length,
          });
        } else if (election.end && req.user.voted === false) {
          req.flash(
            "error",
            "You Can't see the result of election because you are not vote in this election"
          );
          return res.redirect(`/launch/${req.params.url}`);
        } else {
          return res.redirect(`/sucessFully/${election.id}/voted`);
        }
      }
    } catch (error) {
      console.log(error);
      return res.status(422).json(error);
    }
  } else {
    req.flash("please login as a voter.");
    return res.redirect(`/launch/${req.params.url}`);
  }
});

app.get("/signout/:url/Voter", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.flash("success", "Sign Out successfully!!!");
    res.redirect(`/launch/${req.params.url}`);
  });
});

app.post("/userVote/:elctionId", async (req, res) => {
  try {
    const election = await Election.findByPk(req.params.elctionId);
    const quetions = await Quetion.getQuetions(election.id);
    const voter = await Voter.findByPk(req.user.id);
    console.log(req.user);

    for (let i = 0; i < quetions.length; i++) {
      const vote = req.body[`vote-${quetions[i].id}`];
      console.log(vote);
      await Vote.addVote({
        electionId: election.id,
        quetionId: quetions[i].id,
        voterId: voter.id,
        voteVal: vote,
      });
    }

    await voter.votedVoter();
    return res.redirect(`/sucessFully/${election.id}/voted`);
  } catch (error) {
    console.log(error);
    return res.status(422).json(error);
  }
});

app.get("/sucessFully/:id/voted", async (req, res) => {
  const election = await Election.findByPk(req.params.id);
  res.render("sucessFullyVoted", {
    election,
    csrfToken: req.csrfToken(),
  });
});

app.get(
  "/election/:id/preview/result",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    if (req.user.role === "admin") {
      const election = await Election.findByPk(req.params.id);
      if (election.launch === false && election.end === false) {
        req.flash(
          "error",
          "Please first a launch a election after that You can preview result"
        );
        return res.redirect(`/election/${election.id}`);
      }
      try {
        const quetions = await Quetion.getQuetions(req.params.id);
        const optionList = [];
        const Votes = [];
        const quetionId = [];

        for (let i = 0; i < quetions.length; i++) {
          quetionId.push(quetions[i].id);
          const options = await Option.getOptions(quetions[i].id);
          let optionNames = [];
          const voteArray = [];
          for (let j = 0; j < options.length; j++) {
            optionNames.push(options[j].optionName);
            const vote = await Vote.retriveVoteCount(
              options[j].optionName,
              election.id,
              quetions[i].id
            );
            voteArray.push(vote.length);
          }
          optionList.push(optionNames);
          Votes.push(voteArray);
        }

        const totalVoters = await Voter.getVoters(election.id);
        const remianVoting = await Voter.remainVote(election.id);
        const votingCount = await Voter.voting(election.id);

        return res.render("previewResult", {
          election,
          quetions,
          quetionId,
          optionList,
          Votes,
          totalVoters: totalVoters.length,
          remianVoting: remianVoting.length,
          votingCount: votingCount.length,
        });
      } catch (error) {
        console.log(error);
        return res.status(422).json(error);
      }
    } else {
      return res.redirect("/");
    }
  }
);

app.post("/forgot/password", async (req, res) => {
  if (req.body.password.length === 0) {
    req.flash("error", "password can't be empty for a update!!");
    return res.redirect("/login");
  }
  if (req.body.email.length === 0) {
    req.flash("error", "email can't be empty for a update!!");
    return res.redirect("/login");
  }
  if (req.body.password !== req.body.conformPassword) {
    req.flash("error", "Your password and conform Password not same");
    return res.redirect("/login");
  }
  try {
    const pwd = await bcrypt.hash(req.body.password, saltRound);
    const admin = await Admin.resetPassword(req.body.email, pwd);
    if (admin == 0) {
      req.flash(
        "error",
        "You are trying to update a password which user dosen't exists"
      );
      return res.redirect("/login");
    }
    req.flash("success", "Password Updated!!!");
    return res.redirect("/login");
  } catch (error) {
    console.log(error);
    return res.status(422).json(error);
  }
});

// sign in ,out,up
app.get("/signup", (req, res) => {
  res.render("signup", {
    title: "signUp",
    csrfToken: req.csrfToken(),
  });
});

app.get("/login", (req, res) => {
  res.render("login", {
    title: "login",
    csrfToken: req.csrfToken(),
  });
});

app.get("/signout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.flash("success", "Log out successfully!!!");
    res.redirect("/");
  });
});

app.post(
  "/session",
  passport.authenticate("user-local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (req, res) => {
    console.log(req.user);
    req.flash("success", "Log In successfully!!!");
    res.redirect("/listOfElection");
  }
);

app.post("/users", async (req, res) => {
  if (req.body.password.length === 0) {
    req.flash("error", "password can't be empty!!");
    return res.redirect("/signup");
  }
  console.log("Body : ", req.body.firstName);
  const pwd = await bcrypt.hash(req.body.password, saltRound);
  try {
    const user = await Admin.create({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      role: "admin",
      password: pwd,
    });

    req.logIn(user, (err) => {
      if (err) {
        console.log(err);
      }
      req.flash("success", "Sign Up successfully!!!");
      return res.redirect("/listOfElection");
    });
  } catch (error) {
    console.log(error);
    console.log(error.name);
    if (error.name == "SequelizeValidationError") {
      error.errors.forEach((e) => {
        if (e.message == "Please provide a firstName") {
          req.flash("error", "Please provide a firstName");
        }
        if (e.message == "Please provide email_id") {
          req.flash("error", "Please provide email_id");
        }
      });
      return res.redirect("/signup");
    } else if (error.name == "SequelizeUniqueConstraintError") {
      error.errors.forEach((e) => {
        if (e.message == "email must be unique") {
          req.flash("error", "User with this email already exists");
        }
      });
      return res.redirect("/signup");
    } else {
      return res.status(422).json(error);
    }
  }
});

module.exports = app;
