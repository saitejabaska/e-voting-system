/* eslint-disable no-undef */
const request = require("supertest");
var cheerio = require("cheerio");
const db = require("../models/index");
const app = require("../app");
let server;
let agent;

function getCsrfToken(res) {
  var $ = cheerio.load(res.text);
  return $("[name=_csrf]").val();
}

// eslint-disable-next-line no-unused-vars
async function login(agent, username, password) {
  let res = await agent.get("/login");
  var csrfToken = getCsrfToken(res);
  res = await agent.post("/session").send({
    email: username,
    password: password,
    _csrf: csrfToken,
  });
}

describe("Test case for database", () => {
  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    server = app.listen(process.env.PORT || 5000, () => {});
    agent = request.agent(server);
  });

  afterAll(async () => {
    try {
      await db.sequelize.close();
      await server.close();
    } catch (error) {
      console.log(error);
    }
  });

  test("admin Sign Up", async () => {
    var res = await agent.get("/signup");
    var csrfToken = getCsrfToken(res);
    const response = await agent.post("/users").send({
      firstName: "Dipu",
      lastName: "rvl",
      email: "dipu@gmail.com",
      password: "dipu",
      _csrf: csrfToken,
    });
    expect(response.statusCode).toBe(302);
  });

  test("admin sign out", async () => {
    var res = await agent.get("/listofElection");
    expect(res.statusCode).toBe(200);
    res = await agent.get("/signout");
    expect(res.statusCode).toBe(302);
    res = await agent.get("/listofElection");
    expect(res.statusCode).toBe(302);
  });

  test("admin log in", async () => {
    var agent = request.agent(server);
    var res = await agent.get("/listofElection");
    expect(res.statusCode).toBe(302);
    await login(agent, "dipu@gmail.com", "dipu");
    res = await agent.get("/listofElection");
    expect(res.statusCode).toBe(200);
  });

  test("Creates a Election", async () => {
    var agent = request.agent(server);
    await login(agent, "dipu@gmail.com", "dipu");
    var res = await agent.get("/listofElection");
    var csrfToken = getCsrfToken(res);
    const response = await agent.post("/election").send({
      title: "Class Monitor 2023",
      url: "monitor",
      _csrf: csrfToken,
    });
    expect(response.statusCode).toBe(302);
  });

  test("Modify a election", async () => {
    var agent = request.agent(server);
    await login(agent, "dipu@gmail.com", "dipu");
    var res = await agent.get("/listofElection");
    var csrfToken = getCsrfToken(res);
    await agent.post("/election").send({
      title: "Head Of community",
      url: "HOC",
      _csrf: csrfToken,
    });

    res = await agent.get("/listofElection").set("Accept", "application/json");
    const parseElections = JSON.parse(res.text);
    const election = parseElections.ele[parseElections.ele.length - 1];

    res = await agent.get("/listofElection");
    csrfToken = getCsrfToken(res);

    res = await agent.post(`/modify/election/${election.id}`).send({
      title: "Head Of Department",
      url: "HOD",
      _csrf: csrfToken,
    });

    expect(res.statusCode).toBe(302);

    res = await agent.get("/listofElection").set("Accept", "application/json");
    var ParseElections = JSON.parse(res.text);
    var updateelection = ParseElections.ele[ParseElections.ele.length - 1];

    expect(updateelection.title).toBe("Head Of Department");
    expect(updateelection.url).toBe("HOD");
  });

  test("Delete a election", async () => {
    var agent = request.agent(server);
    await login(agent, "dipu@gmail.com", "dipu");
    var res = await agent.get("/listofElection");
    var csrfToken = getCsrfToken(res);
    await agent.post("/election").send({
      title: "Temp Election for delete test",
      url: "deltest",
      _csrf: csrfToken,
    });

    res = await agent.get("/listofElection").set("Accept", "application/json");
    const parseElections = JSON.parse(res.text);
    const election = parseElections.ele[parseElections.ele.length - 1];

    res = await agent.get("/listofElection");
    csrfToken = getCsrfToken(res);

    const rese = await agent
      .delete(`/delElection/${election.id}`)
      .send({ _csrf: csrfToken });

    const bool = Boolean(rese.text);
    expect(bool).toBe(true);
  });

  test("Creates a Quetion", async () => {
    var agent = request.agent(server);
    await login(agent, "dipu@gmail.com", "dipu");
    var res = await agent.get("/listofElection");
    var csrfToken = getCsrfToken(res);
    await agent.post("/election").send({
      title: "HOD Selection",
      url: "hod",
      _csrf: csrfToken,
    });

    const elections = await agent
      .get("/listofElection")
      .set("Accept", "application/json");
    const parseElections = JSON.parse(elections.text);
    const election = parseElections.ele[parseElections.ele.length - 1];

    res = await agent
      .get(`/election/${election.id}/addQuetion`)
      .set("Accept", "application/json");
    var quetions = JSON.parse(res.text);
    const totalQuetions = quetions.que.length;

    res = await agent.get(`/election/${election.id}/addQuetion`);
    csrfToken = getCsrfToken(res);

    await agent.post(`/addquetion/${election.id}`).send({
      title: "Name of hods",
      desc: "add a multiple hod option so the voter can vote on it.",
      _csrf: csrfToken,
    });

    res = await agent
      .get(`/election/${election.id}/addQuetion`)
      .set("Accept", "application/json");

    quetions = JSON.parse(res.text);
    expect(quetions.que.length).toBe(totalQuetions + 1);
  });

  test("should modify a quetion", async () => {
    var agent = request.agent(server);
    await login(agent, "dipu@gmail.com", "dipu");

    const elections = await agent
      .get("/listofElection")
      .set("Accept", "application/json");
    const parseElections = JSON.parse(elections.text);
    const election = parseElections.ele[parseElections.ele.length - 1];

    res = await agent.get(`/election/${election.id}/addQuetion`);
    var csrfToken = getCsrfToken(res);

    await agent.post(`/addquetion/${election.id}`).send({
      title: "Create a quetion for Modify",
      desc: "Create a quetion for Modify so test case run for modify",
      _csrf: csrfToken,
    });

    res = await agent
      .get(`/election/${election.id}/addQuetion`)
      .set("Accept", "application/json");
    var quetions = JSON.parse(res.text);
    const newQuetion = quetions.que[quetions.que.length - 1];

    res = await agent.get(`/election/${election.id}/addQuetion`);
    csrfToken = getCsrfToken(res);

    await agent.post(`/modify/${election.id}/quetion/${newQuetion.id}`).send({
      title: "Modify a quetion for a test modify",
      desc: "here modify a quetion for a test case",
      _csrf: csrfToken,
    });

    res = await agent
      .get(`/election/${election.id}/addQuetion`)
      .set("Accept", "application/json");
    quetions = JSON.parse(res.text);
    const UpdateQuetion = quetions.que[quetions.que.length - 1];

    expect(UpdateQuetion.title).toBe("Modify a quetion for a test modify");
    expect(UpdateQuetion.description).toBe(
      "here modify a quetion for a test case"
    );
  });

  test("delete a Quetion", async () => {
    var agent = request.agent(server);
    await login(agent, "dipu@gmail.com", "dipu");

    const elections = await agent
      .get("/listofElection")
      .set("Accept", "application/json");
    const parseElections = JSON.parse(elections.text);
    const election = parseElections.ele[parseElections.ele.length - 1];

    var res = await agent.get(`/election/${election.id}/addQuetion`);
    var csrfToken = getCsrfToken(res);

    await agent.post(`/addquetion/${election.id}`).send({
      title: "Name of Candidates",
      desc: "add a multiple hod option so the voter can vote on it.",
      _csrf: csrfToken,
    });

    res = await agent
      .get(`/election/${election.id}/addQuetion`)
      .set("Accept", "application/json");

    var quetions = JSON.parse(res.text);
    const que = quetions.que[quetions.que.length - 1];

    res = await agent.get(`/election/${election.id}/addQuetion`);
    csrfToken = getCsrfToken(res);

    const rese = await agent
      .delete(`/election/${election.id}/delQuetion/${que.id}`)
      .send({ _csrf: csrfToken });

    const bool = Boolean(rese.text);
    expect(bool).toBe(true);
  });

  test("Creates a Options", async () => {
    var agent = request.agent(server);
    await login(agent, "dipu@gmail.com", "dipu");

    const elections = await agent
      .get("/listofElection")
      .set("Accept", "application/json");
    const parseElections = JSON.parse(elections.text);
    const election = parseElections.ele[parseElections.ele.length - 1];

    res = await agent
      .get(`/election/${election.id}/addQuetion`)
      .set("Accept", "application/json");
    var quetions = JSON.parse(res.text);
    const totalQuetions = quetions.que.length;
    const que = quetions.que[totalQuetions - 1];

    res = await agent
      .get(`/election/${election.id}/quetion/${que.id}/addOptions`)
      .set("Accept", "application/json");
    var csrfToken = getCsrfToken(res);
    var resParse = JSON.parse(res.text);
    const totalOptions = resParse.Options.length;

    res = await agent.get(
      `/election/${election.id}/quetion/${que.id}/addOptions`
    );
    csrfToken = getCsrfToken(res);

    await agent
      .post(`/election/${election.id}/quetion/${que.id}/addOptions`)
      .send({
        name: "Dipesh",
        qid: que.id,
        _csrf: csrfToken,
      });

    res = await agent
      .get(`/election/${election.id}/quetion/${que.id}/addOptions`)
      .set("Accept", "application/json");

    resParse = JSON.parse(res.text);
    expect(resParse.Options.length).toBe(totalOptions + 1);
  });

  test("Modify a option in quetion", async () => {
    var agent = request.agent(server);
    await login(agent, "dipu@gmail.com", "dipu");

    const elections = await agent
      .get("/listofElection")
      .set("Accept", "application/json");
    const parseElections = JSON.parse(elections.text);
    const election = parseElections.ele[parseElections.ele.length - 1];

    res = await agent
      .get(`/election/${election.id}/addQuetion`)
      .set("Accept", "application/json");
    var quetions = JSON.parse(res.text);
    const totalQuetions = quetions.que.length;
    const que = quetions.que[totalQuetions - 1];

    res = await agent.get(
      `/election/${election.id}/quetion/${que.id}/addOptions`
    );
    csrfToken = getCsrfToken(res);

    await agent
      .post(`/election/${election.id}/quetion/${que.id}/addOptions`)
      .send({
        name: "Jinal",
        qid: que.id,
        _csrf: csrfToken,
      });

    res = await agent
      .get(`/election/${election.id}/quetion/${que.id}/addOptions`)
      .set("Accept", "application/json");
    csrfToken = getCsrfToken(res);
    var resParse = JSON.parse(res.text);
    const totalOptions = resParse.Options.length;
    var newOption = resParse.Options[totalOptions - 1];

    res = await agent.get(
      `/election/${election.id}/quetion/${que.id}/addOptions`
    );
    csrfToken = getCsrfToken(res);

    await agent
      .post(
        `/election/${election.id}/quetion/${que.id}/option/${newOption.id}/modify`
      )
      .send({
        optionName: "Jeni",
        _csrf: csrfToken,
      });

    res = await agent
      .get(`/election/${election.id}/quetion/${que.id}/addOptions`)
      .set("Accept", "application/json");
    csrfToken = getCsrfToken(res);
    resParse = JSON.parse(res.text);
    var updateOP = resParse.Options[resParse.Options.length - 1];

    expect(updateOP.optionName).toBe("Jeni");
  });

  test("Delete a Options", async () => {
    var agent = request.agent(server);
    await login(agent, "dipu@gmail.com", "dipu");

    const elections = await agent
      .get("/listofElection")
      .set("Accept", "application/json");
    const parseElections = JSON.parse(elections.text);
    const election = parseElections.ele[parseElections.ele.length - 1];

    var res = await agent
      .get(`/election/${election.id}/addQuetion`)
      .set("Accept", "application/json");
    var quetions = JSON.parse(res.text);
    const totalQuetions = quetions.que.length;
    const que = quetions.que[totalQuetions - 1];

    res = await agent.get(
      `/election/${election.id}/quetion/${que.id}/addOptions`
    );
    var csrfToken = getCsrfToken(res);

    await agent
      .post(`/election/${election.id}/quetion/${que.id}/addOptions`)
      .send({
        name: "Delete OPtion",
        qid: que.id,
        _csrf: csrfToken,
      });

    res = await agent
      .get(`/election/${election.id}/quetion/${que.id}/addOptions`)
      .set("Accept", "application/json");
    resParse = JSON.parse(res.text);
    const option = resParse.Options[resParse.Options.length - 1];

    res = await agent.get(
      `/election/${election.id}/quetion/${que.id}/addOptions`
    );
    csrfToken = getCsrfToken(res);

    const rese = await agent
      .delete(`/election/${election.id}/delOption/${option.id}`)
      .send({ _csrf: csrfToken });

    const bool = Boolean(rese.text);
    expect(bool).toBe(true);
  });

  test("should be add a voter in a elction", async () => {
    var agent = request.agent(server);
    await login(agent, "dipu@gmail.com", "dipu");

    const elections = await agent
      .get("/listofElection")
      .set("Accept", "application/json");
    const parseElections = JSON.parse(elections.text);
    const election = parseElections.ele[parseElections.ele.length - 1];

    res = await agent
      .get(`/election/${election.id}/voter`)
      .set("Accept", "application/json");
    var resParse = JSON.parse(res.text);
    const totalVoter = resParse.voters.length;

    res = await agent.get(`/election/${election.id}/voter`);
    var csrfToken = getCsrfToken(res);

    await agent.post(`/election/${election.id}/addvoter`).send({
      voterId: "VgK123",
      password: "12345678",
      _csrf: csrfToken,
    });

    res = await agent
      .get(`/election/${election.id}/voter`)
      .set("Accept", "application/json");
    resParse = JSON.parse(res.text);

    expect(resParse.voters.length).toBe(totalVoter + 1);
  });

  test("should modify a voter", async () => {
    var agent = request.agent(server);
    await login(agent, "dipu@gmail.com", "dipu");

    const elections = await agent
      .get("/listofElection")
      .set("Accept", "application/json");
    const parseElections = JSON.parse(elections.text);
    const election = parseElections.ele[parseElections.ele.length - 1];

    res = await agent.get(`/election/${election.id}/voter`);
    var csrfToken = getCsrfToken(res);

    await agent.post(`/election/${election.id}/addvoter`).send({
      voterId: "DIpu",
      password: "12345678",
      _csrf: csrfToken,
    });

    res = await agent
      .get(`/election/${election.id}/voter`)
      .set("Accept", "application/json");
    var resParse = JSON.parse(res.text);
    const voter = resParse.voters[resParse.voters.length - 1];

    res = await agent.get(`/election/${election.id}/voter`);
    csrfToken = getCsrfToken(res);

    res = await agent
      .post(`/election/${election.id}/modify/voter/${voter.id}`)
      .send({
        pwd: "87654321",
        _csrf: csrfToken,
      });

    expect(res.statusCode).toBe(302);
  });

  test("should be delete a voter from a elction", async () => {
    var agent = request.agent(server);
    await login(agent, "dipu@gmail.com", "dipu");

    const elections = await agent
      .get("/listofElection")
      .set("Accept", "application/json");
    const parseElections = JSON.parse(elections.text);
    const election = parseElections.ele[parseElections.ele.length - 1];

    var res = await agent.get(`/election/${election.id}/voter`);
    var csrfToken = getCsrfToken(res);

    await agent.post(`/election/${election.id}/addvoter`).send({
      voterId: "Dipesh123",
      password: "12345678",
      _csrf: csrfToken,
    });

    res = await agent
      .get(`/election/${election.id}/voter`)
      .set("Accept", "application/json");
    var resParse = JSON.parse(res.text);
    const voter = resParse.voters[resParse.voters.length - 1];

    res = await agent.get(`/election/${election.id}/voter`);
    csrfToken = getCsrfToken(res);

    const rese = await agent
      .delete(`/delVoter/${voter.id}`)
      .send({ _csrf: csrfToken });

    const bool = Boolean(rese.text);
    expect(bool).toBe(true);
  });

  test("should preview a election", async () => {
    var agent = request.agent(server);
    await login(agent, "dipu@gmail.com", "dipu");

    const elections = await agent
      .get("/listofElection")
      .set("Accept", "application/json");
    const parseElections = JSON.parse(elections.text);
    const election = parseElections.ele[parseElections.ele.length - 1];

    res = await agent.get(`/election/${election.id}/preview`);

    expect(res.statusCode).toBe(200);
  });

  test("Launch a election", async () => {
    var agent = request.agent(server);
    await login(agent, "dipu@gmail.com", "dipu");
    var res = await agent.get("/listofElection");
    var csrfToken = getCsrfToken(res);
    await agent.post("/election").send({
      title: "Launch test Election",
      url: "launchUrl",
      _csrf: csrfToken,
    });

    res = await agent.get("/listofElection").set("Accept", "application/json");
    console.log(res.text);
    const parseElections = JSON.parse(res.text);
    const election = parseElections.ele[parseElections.ele.length - 1];

    res = await agent.get(`/election/${election.id}/addQuetion`);
    csrfToken = getCsrfToken(res);

    await agent.post(`/addquetion/${election.id}`).send({
      title: "WHich animal is Big",
      desc: "Select an animal which biger than every animals",
      _csrf: csrfToken,
    });

    res = await agent
      .get(`/election/${election.id}/addQuetion`)
      .set("Accept", "application/json");
    var quetions = JSON.parse(res.text);
    const totalQuetions = quetions.que.length;
    const que = quetions.que[totalQuetions - 1];

    res = await agent.get(
      `/election/${election.id}/quetion/${que.id}/addOptions`
    );
    csrfToken = getCsrfToken(res);

    await agent
      .post(`/election/${election.id}/quetion/${que.id}/addOptions`)
      .send({
        name: "Tiger",
        qid: que.id,
        _csrf: csrfToken,
      });

    res = await agent.get(
      `/election/${election.id}/quetion/${que.id}/addOptions`
    );
    csrfToken = getCsrfToken(res);

    await agent
      .post(`/election/${election.id}/quetion/${que.id}/addOptions`)
      .send({
        name: "WOlf",
        qid: que.id,
        _csrf: csrfToken,
      });

    res = await agent.get(
      `/election/${election.id}/quetion/${que.id}/addOptions`
    );
    csrfToken = getCsrfToken(res);

    await agent.post(`/addquetion/${election.id}`).send({
      title: "Which teacher is bad ?",
      desc: "Select teacher which you notlike it for remove them...",
      _csrf: csrfToken,
    });

    res = await agent
      .get(`/election/${election.id}/addQuetion`)
      .set("Accept", "application/json");
    quetions = JSON.parse(res.text);
    var quetionsList = quetions.que.length;
    const newque = quetions.que[quetionsList - 1];

    res = await agent.get(
      `/election/${election.id}/quetion/${newque.id}/addOptions`
    );
    csrfToken = getCsrfToken(res);

    await agent
      .post(`/election/${election.id}/quetion/${newque.id}/addOptions`)
      .send({
        name: "HMP",
        qid: newque.id,
        _csrf: csrfToken,
      });

    res = await agent.get(
      `/election/${election.id}/quetion/${newque.id}/addOptions`
    );
    csrfToken = getCsrfToken(res);

    await agent
      .post(`/election/${election.id}/quetion/${newque.id}/addOptions`)
      .send({
        name: "DDD",
        qid: newque.id,
        _csrf: csrfToken,
      });

    res = await agent.get(`/election/${election.id}/voter`);
    csrfToken = getCsrfToken(res);

    await agent.post(`/election/${election.id}/addvoter`).send({
      voterId: "444",
      password: "12345678",
      _csrf: csrfToken,
    });

    res = await agent.get(`/election/${election.id}/voter`);
    csrfToken = getCsrfToken(res);

    await agent.post(`/election/${election.id}/addvoter`).send({
      voterId: "555",
      password: "12345678",
      _csrf: csrfToken,
    });

    res = await agent.get(`/election/${election.id}/voter`);
    csrfToken = getCsrfToken(res);

    await agent.post(`/election/${election.id}/addvoter`).send({
      voterId: "666",
      password: "12345678",
      _csrf: csrfToken,
    });

    res = await agent.get(`/election/${election.id}/launch`);

    res = await agent
      .get(`/election/${election.id}`)
      .set("Accept", "application/json");
    console.log(res.text);
    var Elections = JSON.parse(res.text);
    expect(Elections.election.launch).toBe(true);
  });

  test("should log in a voter", async () => {
    var agent = request.agent(server);
    await login(agent, "dipu@gmail.com", "dipu");

    var res = await agent
      .get("/listofElection")
      .set("Accept", "application/json");
    console.log(res.text);
    const parseElections = JSON.parse(res.text);
    const election = parseElections.ele[parseElections.ele.length - 1];

    res = await agent.get(`/launch/${election.url}`);
    var csrfToken = getCsrfToken(res);

    res = await agent.post(`/sessionVoter/${election.url}`).send({
      voterID: "666",
      password: "12345678",
      _csrf: csrfToken,
    });

    expect(res.statusCode).toBe(302);

    res = await agent.get(`/vote/${election.url}`);
    expect(res.statusCode).toBe(200);
  });

  test("voter sign out", async () => {
    var agent = request.agent(server);
    await login(agent, "dipu@gmail.com", "dipu");

    var res = await agent
      .get("/listofElection")
      .set("Accept", "application/json");
    console.log(res.text);
    const parseElections = JSON.parse(res.text);
    const election = parseElections.ele[parseElections.ele.length - 1];

    res = await agent.get(`/launch/${election.url}`);
    var csrfToken = getCsrfToken(res);

    res = await agent.post(`/sessionVoter/${election.url}`).send({
      voterID: "666",
      password: "12345678",
      _csrf: csrfToken,
    });

    expect(res.statusCode).toBe(302);

    res = await agent.get(`/vote/${election.url}`);
    expect(res.statusCode).toBe(200);
    console.log(res.statusCode);
    res = await agent.get(`/signout/${election.url}/Voter`);
    expect(res.statusCode).toBe(302);
    res = await agent.get(`/vote/${election.url}`);
    expect(res.statusCode).toBe(302);
  });

  test("should end a elction", async () => {
    var agent = request.agent(server);
    await login(agent, "dipu@gmail.com", "dipu");

    var res = await agent
      .get("/listofElection")
      .set("Accept", "application/json");
    console.log(res.text);
    const parseElections = JSON.parse(res.text);
    const election = parseElections.ele[parseElections.ele.length - 1];

    res = await agent.get(`/election/${election.id}/end`);

    res = await agent
      .get(`/election/${election.id}`)
      .set("Accept", "application/json");
    console.log(res.text);
    var Elections = JSON.parse(res.text);
    expect(Elections.election.end).toBe(true);
  });
});
