import supertest from "supertest";
import app from "../../src/app.js";
import database from "../../src/database/index.js";

describe("Balance route behavior", () => {
  const agent = supertest(app);
  const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTAxMDAsIm5hbWUiOiJVc2VyMyIsImVtYWlsIjoidXNlcjNAZW1haWwuY29tIn0.dbGbm82AOr0E-0q84ODGcGPwi1tcBBfA3VwAb8aFzyU";
  const BASE_URL = "/balance";
  const TRANSACTIONS_URL = "/transactions";
  const TRANSFERS_URL = "/transfers";

  beforeAll(async () => {
    await database.seed.run();
  });

  describe("When calculate user balance", () => {
    test("should return only accounts with transactions",
      async () => {
        const { body, status } = await agent.get(BASE_URL)
          .set("authorization", `bearer ${TOKEN}`);

        expect(status).toBe(200);
        expect(body).toHaveLength(0);
      });

    test("should add incoming values",
      async () => {
        await agent.post(TRANSACTIONS_URL)
          .set("authorization", `bearer ${TOKEN}`)
          .send({
            description: "acc1",
            date: new Date(),
            amount: 100,
            type: "I",
            acc_id: 10100,
            status: true,
          });

        const { status, body } = await agent.get(BASE_URL)
          .set("authorization", `bearer ${TOKEN}`);

        expect(status).toBe(200);
        expect(body).toHaveLength(1);
        expect(body[0].id).toBe(10100);
        expect(body[0].sum).toBe("100.00");
      });

    test("should subtract outgoing values",
      async () => {
        await agent.post(TRANSACTIONS_URL)
          .set("authorization", `bearer ${TOKEN}`)
          .send({
            description: "acc1",
            date: new Date(),
            amount: 200,
            type: "O",
            acc_id: 10100,
            status: true,
          });

        const { status, body } = await agent.get(BASE_URL)
          .set("authorization", `bearer ${TOKEN}`);

        expect(status).toBe(200);
        expect(body).toHaveLength(1);
        expect(body[0].id).toBe(10100);
        expect(body[0].sum).toBe("-100.00");
      });

    test("should not consider pendents transactions",
      async () => {
        await agent.post(TRANSACTIONS_URL)
          .set("authorization", `bearer ${TOKEN}`)
          .send({
            description: "acc1",
            date: new Date(),
            amount: 200,
            type: "O",
            acc_id: 10100,
            status: false,
          });

        const { status, body } = await agent.get(BASE_URL)
          .set("authorization", `bearer ${TOKEN}`);

        expect(status).toBe(200);
        expect(body).toHaveLength(1);
        expect(body[0].id).toBe(10100);
        expect(body[0].sum).toBe("-100.00");
      });

    test("should not merge distinguished account balances",
      async () => {
        await agent.post(TRANSACTIONS_URL)
          .set("authorization", `bearer ${TOKEN}`)
          .send({
            description: "acc1",
            date: new Date(),
            amount: 50,
            type: "I",
            acc_id: 10101,
            status: true,
          });

        const { status, body } = await agent.get(BASE_URL)
          .set("authorization", `bearer ${TOKEN}`);

        expect(status).toBe(200);
        expect(body).toHaveLength(2);
        expect(body[0].id).toBe(10100);
        expect(body[0].sum).toBe("-100.00");
        expect(body[1].id).toBe(10101);
        expect(body[1].sum).toBe("50.00");
      });

    test("should not get another users accounts",
      async () => {
        await agent.post(TRANSACTIONS_URL)
          .set("authorization", `bearer ${TOKEN}`)
          .send({
            description: "acc1",
            date: new Date(),
            amount: 50,
            type: "I",
            acc_id: 20100,
            status: true,
          });

        const { status, body } = await agent.get(BASE_URL)
          .set("authorization", `bearer ${TOKEN}`);

        expect(status).toBe(200);
        expect(body).toHaveLength(2);
        expect(body[0].id).toBe(10100);
        expect(body[0].sum).toBe("-100.00");
        expect(body[1].id).toBe(10101);
        expect(body[1].sum).toBe("50.00");
      });

    test("should calculate past transactions",
      async () => {
        const date = new Date();
        const fiveDaysEarly = date.setDate(date.getDate() - 5);

        await agent.post(TRANSACTIONS_URL)
          .set("authorization", `bearer ${TOKEN}`)
          .send({
            description: "acc1",
            date: fiveDaysEarly,
            amount: 150,
            type: "I",
            acc_id: 10100,
            status: true,
          });

        const { status, body } = await agent.get(BASE_URL)
          .set("authorization", `bearer ${TOKEN}`);

        expect(status).toBe(200);
        expect(body).toHaveLength(2);
        expect(body[0].id).toBe(10100);
        expect(body[0].sum).toBe("150.00");
        expect(body[1].id).toBe(10101);
        expect(body[1].sum).toBe("50.00");
      });

    test("should not calculate future transactions",
      async () => {
        const date = new Date();
        const fiveDaysLater = date.setDate(date.getDate() + 5);

        await agent.post(TRANSACTIONS_URL)
          .set("authorization", `bearer ${TOKEN}`)
          .send({
            description: "acc1",
            date: fiveDaysLater,
            amount: 150,
            type: "I",
            acc_id: 10100,
            status: true,
          });

        const { status, body } = await agent.get(BASE_URL)
          .set("authorization", `bearer ${TOKEN}`);

        expect(status).toBe(200);
        expect(body).toHaveLength(2);
        expect(body[0].id).toBe(10100);
        expect(body[0].sum).toBe("150.00");
        expect(body[1].id).toBe(10101);
        expect(body[1].sum).toBe("50.00");
      });

    test("should consider transfers",
      async () => {
        await agent.post(TRANSFERS_URL)
          .set("authorization", `bearer ${TOKEN}`)
          .send({
            description: "transfer1",
            date: new Date(),
            amount: 250,
            acc_origin_id: 10100,
            acc_destiny_id: 10101,
          });

        const { status, body } = await agent.get(BASE_URL)
          .set("authorization", `bearer ${TOKEN}`);

        expect(status).toBe(200);
        expect(body).toHaveLength(2);
        expect(body[0].id).toBe(10100);
        expect(body[0].sum).toBe("-100.00");
        expect(body[1].id).toBe(10101);
        expect(body[1].sum).toBe("50.00");
      });
  });
});