/* eslint-disable no-undef */
const express = require("express");
const app = express();
const path = require("path");
const { Admin, Option, Election, Voter,question } = require("./models");
const bcrypt = require("bcrypt");
var cookieParser = require("cookie-parser");

const connectEnsureLogin = require("connect-ensure-login");
const session = require("express-session");
const localStrategy = require("passport-local");
const passport = require("passport");
const flash = require("connect-flash");
const csrf = require("tiny-csrf");

const saltRounds = 10;

const bodyParser = require("body-parser");

app.use(flash());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser("ssh! some secret string!"));
app.use(csrf("this_should_be_32_character_long", ["POST", "PUT", "DELETE"]));

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: "my-super-secret-key-3429834092402",
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(function (request, response, next) {
  response.locals.messages = request.flash();
  next();
});

//initializing passport
app.use(passport.initialize());

//using passport session
app.use(passport.session());

//passport session for admin
passport.use(
  "admin",
  new localStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    (username, password, done) => {
      Admin.findOne({ where: { email: username } })
        .then(async (user) => {
          const result = await bcrypt.compare(password, user.password);
          if (result) {
            return done(null, user);
          } else {
            return done(null, false, { message: "Invalid password" });
          }
        })
        .catch((error) => {
          console.log(error);
          return done(null, false, {
            message: "Email is not registered!!Please  Register",
          });
        });
    }
  )
);

// passport session for voter
passport.use(
  "voter",
  new localStrategy(
    {
      usernameField: "voterID",
      passwordField: "password",
      passReqToCallback: true,
    },
    (request, username, password, done) => {
      Voter.findOne({
        where: { voterID: username, electionID: request.params.id },
      })
        .then(async (voter) => {
          const result = await bcrypt.compare(password, voter.password);
          if (result) {
            return done(null, voter);
          } else {
            return done(null, false, { message: "Invalid password" });
          }
        })
        .catch((error) => {
          console.log(error);
          return done(null, false, {
            message: "Voter is not registered!!",
          });
        });
    }
  )
);


//serializing user using passport
passport.serializeUser((user, done) => {
  done(null, user);
});

//deserializing user using passport
passport.deserializeUser((obj, done) => {
  done(null, obj);
});

// landup page
app.get("/", (request, response) => {
  response.render("home");
});

// login page frontend
app.get("/login", (request, response) => {
  if (request.user && request.user.id) {
    return response.redirect("/home");
  }
  response.render("login", { csrf: request.csrfToken() });
});

// signup page 
app.get("/signup", (request, response) => {
  response.render("signup", { csrf: request.csrfToken() });
});


//retreive all elections using loggedinId
app.get(
  "/election",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const login_admin_id = request.user.id;
    const elections = await Election.findAll({
      where: { adminID: login_admin_id },
    });

    return response.json({ elections });
  }
);



// admin home page
app.get(
  "/home",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const login_admin_id = request.user.id;
    const admin = await Admin.findByPk(login_admin_id);

    const elections = await Election.findAll({
      where: { adminID: request.user.id },
    });

    const username=admin.name

    response.render("adminHome", {
      username: username,
      ad_id:login_admin_id,
      elections: elections,
      csrf: request.csrfToken(),
    });
  }
);


// election home page
app.get(
  "/election/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const login_admin_id = request.user.id;
    const admin = await Admin.findByPk(login_admin_id);

    username=admin.name
    const elections = await Election.findByPk(request.params.id);

    if (login_admin_id !== elections.adminID) {
      return response.render("error", {
        errorMessage: "You are not authorized to view this page",
      });
    }

    const questions = await question.findAll({
      where: { electionID: request.params.id },
    });

    const voters = await Voter.findAll({
      where: { electionID: request.params.id },
    });



    response.render("electionHome", {
      election: elections,
      username: username,
      questions: questions,
      voters: voters,
      csrf: request.csrfToken(),
    });
  }
);

// trying to delete an election with id
app.delete(
  "/election/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const adminID = request.user.id;
    const election = await Election.findByPk(request.params.id);

    if (adminID !== election.adminID) {
      console.log("You are not authorized to perform this operation");
      return response.redirect("/home");
    }

    // get all questions of that election
    const questions = await question.findAll({
      where: { electionID: request.params.id },
    });

    // delete all options and then questions of that election
    questions.forEach(async (Question) => {
      const options = await Option.findAll({
        where: { questionID: Question.id },
      });
      options.forEach(async (option) => {
        await Option.destroy({ where: { id: option.id } });
      });
      await question.destroy({ where: { id: Question.id } });
    });

    // delete voters of the election
    const voters = await Voter.findAll({
      where: { electionID: request.params.id },
    });
    voters.forEach(async (voter) => {
      await Voter.destroy({ where: { id: voter.id } });
    });

    try {
      await Election.destroy({ where: { id: request.params.id } });
      return response.json({ ok: true });
    } catch (error) {
      console.log(error);
      response.send(error);
    }
  }
);

// creating a new election
app.post(
  "/election",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.body.name.trim().length === 0) {
      request.flash("error", "Election name can't be empty");
      return response.redirect("/elections/new");
    }

    const login_admin_id = request.user.id;

    // validation checks
    const election = await Election.findOne({
      where: { adminID: login_admin_id, name: request.body.name },
    });
    if (election) {
      request.flash("error", "Election name already used");
      return response.redirect("/elections/new");
    }

    try {
      await Election.add(login_admin_id, request.body.name);
      response.redirect("/home");
    } catch (error) {
      console.log(error);
      response.send(error);
    }
  }
);

// create new election page display
app.get(
  "/elections/new",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const login_admin_id = request.user.id;
    const admin = await Admin.findByPk(login_admin_id);

    response.render("newElection", {
      username: admin.name,
      csrf: request.csrfToken(),
    });
  }
);

// edit election display page
app.get(
  "/election/:id/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const login_admin_id = request.user.id;
    const election = await Election.findByPk(request.params.id);
    const admin = await Admin.findByPk(login_admin_id);

    if (login_admin_id !== election.adminID) {
      return response.render("error", {
        errorMessage: "This operation is not authorised by you.",
      });
    }

    response.render("editElection", {
      election: election,
      username: admin.name,
      csrf: request.csrfToken(),
    });
  }
);

// updating an election name
app.post(
  "/election/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const login_admin_id = request.user.id;
    const elections = await Election.findByPk(request.params.id);

    if (login_admin_id !== elections.adminID) {
      return response.render("error", {
        errorMessage: "You are not authorized to view this page",
      });
    }

    //checking validation
    if (request.body.name.trim().length === 0) {
      request.flash("error", "Election name can't be empty");
      return response.redirect(`/election/${request.params.id}/edit`);
    }
    const sameElection = await Election.findOne({
      where: {
        adminID: login_admin_id,
        name: request.body.name,
      },
    });

    if (sameElection) {
      if (sameElection.id.toString() !== request.params.id) {
        request.flash("error", "Election name already used");
        return response.redirect(`/election/${request.params.id}/edit`);
      } else {
        request.flash("error", "No changes made");
        return response.redirect(`/election/${request.params.id}/edit`);
      }
    }

    try {
      await Election.update(
        { name: request.body.name },
        { where: { id: request.params.id } }
      );
      response.redirect(`/election/${request.params.id}`);
    } catch (error) {
      console.log(error);
      return response.send(error);
    }
  }
);

// creating a new admin display page
app.post("/users", async (request, response) => {
  // validation checking
  if (request.body.email.trim().length === 0) {
    request.flash("error", "Email can't be empty");
    return response.redirect("/signup");
  }

  if (request.body.password.length === 0) {
    request.flash("error", "Password can't be empty");
    return response.redirect("/signup");
  }

  if (request.body.name.length === 0) {
    request.flash("error", "Name can't be empty");
    return response.redirect("/signup");
  }

  

  // check if email already exists
  const admin = await Admin.findOne({ where: { email: request.body.email } });
  if (admin) {
    request.flash("error", "Email already exists");
    return response.redirect("/signup");
  }

  //validating password
  if (request.body.password.length < 8) {
    request.flash("error", "Password must be atleast 8 characters long");
    return response.redirect("/signup");
  }
  // hasing the password using bcrypt
  const hashpwd = await bcrypt.hash(request.body.password, saltRounds); 
  try {
    const user = await Admin.create({
      name: request.body.name,
      email: request.body.email,
      password: hashpwd,
    });
    request.login(user, (err) => {
      if (err) {
        console.log(err);
        response.redirect("/");
      } else {
        request.flash("success", "Sign up successful");
        response.redirect("/home");
      }
    });
  } catch (error) {
    request.flash("error", error.message);
    return response.redirect("/signup");
  }
});

// get all the questions of election
app.get(
  "/election/:id/questions",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const allQuestions = await question.findAll({
      where: { electionID: request.params.id },
    });

    return response.send(allQuestions);
  }
);

// add a question to the election
app.post(
  "/election/:id/questions/add",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const login_admin_id = request.user.id;

    const election = await Election.findByPk(request.params.id);

    if (login_admin_id !== election.adminID) {
      return response.render("error", {
        errorMessage: "You are not authorized to view this page",
      });
    }

    if (election.launched) {
      console.log("Election already launched");
      return response.render("error", {
        errorMessage:
          "You can't edit the election now, the election is already launched",
      });
    }

    // validation checking for adding a question
    if (request.body.title.trim().length === 0) {
      request.flash("error", "Question title can't be empty");
      return response.redirect(`/election/${request.params.id}`);
    }

    const sameQuestion = await question.findOne({
      where: { electionID: request.params.id, title: request.body.title },
    });
    if (sameQuestion) {
      request.flash("error", "Question title already used");
      return response.redirect(`/election/${request.params.id}`);
    }

    try {
      await question.add(
        request.body.title,
        request.body.description,
        request.params.id
      );
      response.redirect(`/election/${request.params.id}`);
    } catch (error) {
      console.log(error);
      return response.send(error);
    }
  }
);

// trying to delete the question
app.delete(
  "/election/:id/question/:questiondID",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const adminID = request.user.id;
    const election = await Election.findByPk(request.params.id);

    if (election.adminID !== adminID) {
      return response.render("error", {
        errorMessage: "You are not authorized to view this page",
      });
    }

    try {
      // deleting all the options for a  question
      await Option.destroy({
        where: { questionID: request.params.questiondID },
      });

      // delete a  question
      await question.destroy({ where: { id: request.params.questiondID } });
      return response.json({ ok: true });
    } catch (error) {
      console.log(error);
      return response.send(error);
    }
  }
);


// try to delete an option for the question
app.delete(
  "/election/:electionID/question/:questionID/option/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const adminID = request.user.id;
    const election = await Election.findByPk(request.params.electionID);

    if (election.adminID !== adminID) {
      return response.render("error", {
        errorMessage: "You are not authorized to view this page",
      });
    }

    const Question = await question.findByPk(request.params.questionID);

    if (!Question) {
      console.log("Question not found");
      return response.render("error", { errorMessage: "Question not found" });
    }

    try {
      await Option.destroy({ where: { id: request.params.id } });
      return response.json({ ok: true });
    } catch (error) {
      console.log(error);
      return response.send(error);
    }
  }
);


// questions home page with all options
app.get(
  "/election/:id/question/:questiondID",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const adminID = request.user.id;
    const admin = await Admin.findByPk(adminID);
    const election = await Election.findByPk(request.params.id);

    if (election.adminID !== adminID) {
      return response.render("error", {
        errorMessage: "This operation is not authorised by you.",
      });
    }

    const Question = await question.findByPk(request.params.questiondID);

    const options = await Option.findAll({
      where: { questionID: request.params.questiondID },
    });

    response.render("questionHome", {
      username: admin.name,
      question: Question,
      election: election,
      options: options,
      csrf: request.csrfToken(),
    });
  }
);


// adding option to the questions asked in election
app.post(
  "/election/:electionID/question/:questionID/options/add",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const adminID = request.user.id;

    const election = await Election.findByPk(request.params.electionID);

    if (election.adminID !== adminID) {
      console.log("You don't have access to edit this election");
      return response.render("error", {
        errorMessage: "You are not authorized to view this page",
      });
    }

    if (election.launched) {
      console.log("Election already launched");
      return response.render("error", {
        errorMessage: "Election is already live",
      });
    }

    // The  validation check happens here
    if (request.body.option.trim().length === 0) {
      request.flash("error", "Option can't be empty");
      return response.redirect(
        `/election/${request.params.electionID}/question/${request.params.questionID}`
      );
    }

    const sameOption = await Option.findOne({
      where: {
        questionID: request.params.questionID,
        value: request.body.option,
      },
    });
    if (sameOption) {
      request.flash("error", "Option already exists");
      return response.redirect(
        `/election/${request.params.electionID}/question/${request.params.questionID}`
      );
    }

    try {
      await Option.add(request.body.option, request.params.questionID);
      response.redirect(
        `/election/${request.params.electionID}/question/${request.params.questionID}`
      );
    } catch (error) {
      console.log(error);
      return response.send(error);
    }
  }
);

// trying to get the  options for a election
app.get(
  "/election/:electionID/question/:questionID/options",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {

    const options = await Option.findAll({
      where: { questionID: request.params.questionID },
    });
    return response.send(options);
  }
);


// trying to get into launching an  election
app.get(
  "/election/:id/launch",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    console.log("launch initiaited");
    const adminID = request.user.id;
    const election = await Election.findByPk(request.params.id);

    // making sure that admin has access rights
    if (election.adminID !== adminID) {
      console.log("You don't have access to edit this election");
      return response.render("error", {
        errorMessage: "You are not authorized to view this page",
      });
    }

    // make sure that there is atelast 1 question in the election
    const questions = await question.findAll({
      where: { electionID: request.params.id },
    });
    if (questions.length === 0) {
      request.flash("launch", "Please add atleast 1 question");
      return response.redirect(`/election/${request.params.id}`);
    }

    // make sure that each question has alteast 2 options
    for (let i = 0; i < questions.length; i++) {
      const options = await Option.findAll({
        where: { questionID: questions[i].id },
      });
      if (options.length < 1) {
        request.flash(
          "launch",
          "Please add atleast 2 options to each question"
        );
        return response.redirect(`/election/${request.params.id}`);
      }
    }

    // ensure that there is atleast 1 voter to participate in the election

    const voters = await Voter.findAll({
      where: { electionID: request.params.id },
    });
    if (voters.length === 0) {
      request.flash("launch", "Please add atleast 1 voter");
      return response.redirect(`/election/${request.params.id}`);
    }

    try {
      await Election.launch(request.params.id);
      return response.redirect(`/election/${request.params.id}`);
    } catch (error) {
      console.log(error);
      return response.send(error);
    }
  }
);

// trying to get the election preview
app.get(
  "/election/:id/preview",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const adminID = request.user.id;
    const election = await Election.findByPk(request.params.id);

    if (election.adminID !== adminID) {
      console.log("You don't have access to edit this election");
      return response.render("error", {
        errorMessage: "You are not authorized to view this page",
      });
    }

    const questions = await question.findAll({
      where: { electionID: request.params.id },
    });

    const options = [];

    for (let i = 0; i < questions.length; i++) {
      const allOption = await Option.findAll({
        where: { questionID: questions[i].id },
      });
      options.push(allOption);
    }

    response.render("preview", {
      election: election,
      questions: questions,
      options: options,
    });
  }
);

// making an end to the election
app.put(
  "/election/:id/end",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const adminID = request.user.id;
    const election = await Election.findByPk(request.params.id);

    // making sure that admin has access rights fro the election
    if (election.adminID !== adminID) {
      console.log("You don't have access to edit this election");
      return response.render("error", {
        errorMessage: "You are not authorized to view this page",
      });
    }

    if (election.ended === true || election.launched === false) {
      console.log("Election not launched");
      return response.render("error", {
        errorMessage: "Invalid Request",
      });
    }

    try {
      await Election.end(request.params.id);
      return response.json({ ok: true });
    } catch (error) {
      console.log(error);
      return response.send(error);
    }
  }
);


// giving access to edit the question
app.post(
  "/election/:electionID/question/:questionID/update",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    console.log("found");
    const adminID = request.user.id;
    const election = await Election.findByPk(request.params.electionID);

    if (election.adminID !== adminID) {
      console.log("You don't have access to edit this election");
      return response.render("error", {
        errorMessage: "You are not authorized to view this page",
      });
    }

    if (election.launched) {
      console.log("Election already launched");
      return response.render("error", {
        errorMessage: "Invalid request, election is already launched",
      });
    }

    // the validation checks are checked
    if (request.body.title.trim().length === 0) {
      request.flash("error", "Question name cannot be empty");
      return response.redirect(
        `/election/${request.params.electionID}/question/${request.params.questionID}/edit`
      );
    }
    const sameQuestion = await question.findOne({
      where: {
        title: request.body.title,
        description: request.body.description,
        electionID: request.params.electionID,
      },
    });
    if (sameQuestion) {
      if (sameQuestion.id.toString() === request.params.questionID) {
        request.flash("error", "Question name is same as before");
        return response.redirect(
          `/election/${request.params.electionID}/question/${request.params.questionID}/edit`
        );
      } else {
        request.flash("error", "Question name already used");
        return response.redirect(
          `/election/${request.params.electionID}/question/${request.params.questionID}/edit`
        );
      }
    }

    try {
      await question.edit(
        request.body.title,
        request.body.description,
        request.params.questionID
      );
      response.redirect(
        `/election/${request.params.electionID}/question/${request.params.questionID}`
      );
    } catch (error) {
      console.log(error);
      return;
    }
  }
);

// making changes in question frontend
app.get(
  "/election/:electionID/question/:questionID/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const adminID = request.user.id;
    const admin = await Admin.findByPk(adminID);
    const election = await Election.findByPk(request.params.electionID);

    if (election.adminID !== adminID) {
      console.log("You don't have access to edit this election");
      return response.render("error", {
        errorMessage: "You are not authorized to view this page",
      });
    }

    if (election.launched) {
      console.log("Election already launched");
      return response.render("error", {
        errorMessage: "Invalid request, election is already live",
      });
    }

    const Question = await question.findByPk(request.params.questionID);
    response.render("editQuestion", {
      username: admin.name,
      election: election,
      question: Question,
      csrf: request.csrfToken(),
    });
  }
);

// trying to add an voter
app.post(
  "/election/:id/voters/add",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const adminID = request.user.id;
    const election = await Election.findByPk(request.params.id);

    if (election.adminID !== adminID) {
      console.log("You don't have access to edit this election");
      return response.render("error", {
        errorMessage: "You are not authorized to view this page",
      });
    }

    if (election.ended) {
      return response.render("error", {
        errorMessage: "Invalid request, election is ended",
      });
    }

    // making validation checks
    if (request.body.voterID.trim().length === 0) {
      request.flash("voterError", "Voter ID can't be empty");
      return response.redirect(`/election/${request.params.id}`);
    }

    if (request.body.password.length === 0) {
      request.flash("voterError", "Password can't be empty");
      return response.redirect(`/election/${request.params.id}`);
    }

    if (request.body.password.length < 5) {
      request.flash("voterError", "Password must be of atleast length 5");
      return response.redirect(`/election/${request.params.id}`);
    }

    const sameVoter = await Voter.findOne({
      where: { electionID: request.params.id, voterID: request.body.voterID },
    });
    if (sameVoter) {
      request.flash("voterError", "Voter ID already used");
      return response.redirect(`/election/${request.params.id}`);
    }

    try {
      // hashing the password
      const hashpwd = await bcrypt.hash(request.body.password, saltRounds);

      await Voter.add(request.body.voterID, hashpwd, request.params.id);
      response.redirect(`/election/${request.params.id}`);
    } catch (error) {
      console.log(error);
      return response.send(error);
    }
  }
);

// access to delete the voter
app.post(
  "/election/:electionID/voter/:voterID/delete",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const adminID = request.user.id;
    const election = await Election.findByPk(request.params.electionID);

    if (election.adminID !== adminID) {
      console.log("You don't have access to edit this election");
      return response.render("error", {
        errorMessage: "You are not authorized to view this page",
      });
    }

    if (election.ended) {
      return response.render("error", {
        errorMessage: "Inavlid request, election is ended",
      });
    }

    const voter = await Voter.findByPk(request.params.voterID);

    if (voter.voted) {
      return response.render("error", {
        errorMessage: "Invalid request, voter has already voted",
      });
    }

    try {
      await Voter.delete(request.params.voterID);
      return response.json({ ok: true });
    } catch (error) {
      console.log(error);
      return response.send(error);
    }
  }
);

// changing edit option frontend
app.get(
  "/election/:electionID/question/:questionID/option/:optionID/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const adminID = request.user.id;
    const admin = await Admin.findByPk(adminID);
    const election = await Election.findByPk(request.params.electionID);

    if (election.adminID !== adminID) {
      return response.render("error", {
        errorMessage: "You are not authorized to view this page",
      });
    }

    if (election.launched) {
      console.log("Election already launched");
      return response.render("error", {
        errorMessage: "Invalid request, election is already launched",
      });
    }

    const Question = await question.findByPk(request.params.questionID);
    const option = await Option.findByPk(request.params.optionID);
    response.render("editOption", {
      username: admin.name,
      election: election,
      question: Question,
      option: option,
      csrf: request.csrfToken(),
    });
  }
);

//  making edit option
app.post(
  "/election/:electionID/question/:questionID/option/:optionID/update",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const adminID = request.user.id;
    const election = await Election.findByPk(request.params.electionID);

    if (election.adminID !== adminID) {
      console.log("You don't have access to edit this election");
      return response.render("error", {
        errorMessage: "You are not authorized to view this page",
      });
    }

    if (election.launched) {
      console.log("Election already launched");
      return response.render("error", {
        errorMessage: "Invalid request, election is already launched",
      });
    }

    // ensure to check validation 
    if (request.body.value.trim().length === 0) {
      request.flash("error", "Option can't be empty");
      return response.redirect(
        `/election/${request.params.electionID}/question/${request.params.questionID}/option/${request.params.optionID}/edit`
      );
    }

    const sameOption = await Option.findOne({
      where: {
        questionID: request.params.questionID,
        value: request.body.value,
      },
    });

    if (sameOption) {
      if (sameOption.id.toString() !== request.params.optionID) {
        request.flash("error", "Option already exists");
        return response.redirect(
          `/election/${request.params.electionID}/question/${request.params.questionID}/option/${request.params.optionID}/edit`
        );
      } else {
        request.flash("error", "No changes made");
        return response.redirect(
          `/election/${request.params.electionID}/question/${request.params.questionID}/option/${request.params.optionID}/edit`
        );
      }
    }

    try {
      await Option.edit(request.body.value, request.params.optionID);
      response.redirect(
        `/election/${request.params.electionID}/question/${request.params.questionID}`
      );
    } catch (error) {
      console.log(error);
      return;
    }
  }
);

// trying cast vote frontend
app.get("/election/:id/vote", async (request, response) => {
  const election = await Election.findByPk(request.params.id);

  if (election.launched === false) {
    console.log("Election not launched");
    return response.render("error", {
      errorMessage: "Election not launched yet",
    });
  }

  // trying to redirect to results page if election is over
  if (election.ended === true) {
    console.log("Election ended");
    return response.redirect(`/election/${request.params.id}/result`);
  }

  const questions = await question.findAll({
    where: {
      electionID: request.params.id,
    },
  });
  const options = [];

  for (let i = 0; i < questions.length; i++) {
    const allOption = await Option.findAll({
      where: { questionID: questions[i].id },
    });
    options.push(allOption);
  }

  // the voter logged in
  if (request.user && request.user.id && request.user.voterID) {
    const voter = await Voter.findByPk(request.user.id);

    response.render("vote", {
      election: election,
      questions: questions,
      options: options,
      verified: true,
      submitted: voter.voted,
      voter: voter,
      csrf: request.csrfToken(),
    });
  } else {
    response.render("vote", {
      election: election,
      questions: [],
      options: [],
      verified: false,
      submitted: false,
      csrf: request.csrfToken(),
    });
  }
});

// logining for the  voter
app.post(
  "/election/:id/vote",
  passport.authenticate("voter", {
    failureRedirect: "back",
    failureFlash: true,
  }),
  function (request, response) {
    return response.redirect(`/election/${request.params.id}/vote`);
  }
);

// submit voter response
app.post(
  "/election/:electionID/voter/:id/submit",
  async (request, response) => {
    const election = await Election.findByPk(request.params.electionID);

    // validation checks
    if (election.launched === false) {
      console.log("Election not launched");
      return response.render("error", {
        errorMessage: "Election not launched yet",
      });
    }

    if (election.ended === true) {
      console.log("Election ended");
      return response.render("error", {
        errorMessage: "Election has ended",
      });
    }

    try {
      const questions = await question.findAll({
        where: {
          electionID: request.params.electionID,
        },
      });

      let responses = [];

      for (let i = 0; i < questions.length; i++) {
        const responseID = Number(request.body[`question-${questions[i].id}`]);
        responses.push(responseID);
      }

      // adding responses of voter
      await Voter.addResponse(request.params.id, responses);

      // marking the voter as voted
      await Voter.markVoted(request.params.id);

      // rendering thank you message
      return response.redirect(`/election/${election.id}/vote`);
    } catch (error) {
      console.log(error);
      return response.send(error);
    }
  }
);

// showing election results frontend
app.get(
  "/election/:id/result",
  // connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    //  trying to fetch and calculating all results
    const questions = await question.findAll({
      where: {
        electionID: request.params.id,
      },
    });

    const voters = await Voter.findAll({
      where: {
        electionID: request.params.id,
      },
    });

    let votesCast = 0;
    voters.forEach((voter) => {
      if (voter.voted) {
        votesCast++;
      }
    });

    const totalVoters = voters.length;

    let optionPercentage = [];

    for (let i = 0; i < questions.length; i++) {
      // staking pecific question
      let array = [];

      // making all options of that question
      const allOption = await Option.findAll({
        where: { questionID: questions[i].id },
      });

      allOption.forEach((option) => {
        // trying to count for specific option
        let count = 0;

        voters.forEach((voter) => {
          if (voter.responses.includes(option.id)) {
            count++;
          }
        });

        const percent = (count * 100) / totalVoters;

        // adding the percentage for that specific option of specific question
        array.push(percent.toFixed(2));
      });

      optionPercentage.push(array);
    }

    const options = [];

    for (let i = 0; i < questions.length; i++) {
      const allOption = await Option.findAll({
        where: { questionID: questions[i].id },
      });
      options.push(allOption);
    }

    const election = await Election.findByPk(request.params.id);

    //case where if admin logged in and not voter logged in
    if (request.user && request.user.id && !request.user.voterID) {
      const adminID = request.user.id;
      const admin = await Admin.findByPk(adminID);

      if (adminID !== election.adminID && !election.ended) {
        return response.send("You are not authorized to view this page");
      }

      response.render("result", {
        admin: true,
        username: admin.name,
        election: election,
        questions: questions,
        options: options,
        data: optionPercentage,
        votesCast: votesCast,
        totalVoters: totalVoters,
      });
    } else {
      //case for  not admin and election not ended
      if (!election.ended) {
        return response.render("error", {
          errorMessage: "You are not authorized to view this page",
        });
      }

      //try  getting into the admin username
      const admin = await Admin.findByPk(election.adminID);
      return response.render("result", {
        admin: false,
        username: admin.name,
        election: election,
        questions: questions,
        options: options,
        data: optionPercentage,
        votesCast: votesCast,
        totalVoters: totalVoters,
      });
    }
  }
);

//  make  admin signout
app.get("/signout", (request, response) => {
  request.logout((err) => {
    if (err) {
      return next(err);
    } else {
      response.redirect("/");
    }
  });
});

app.post(
  "/session",
  passport.authenticate("admin", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  function (request, response) {
    response.redirect("/home");
  }
);




module.exports = app;
