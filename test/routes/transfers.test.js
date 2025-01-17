/* eslint-disable no-unused-vars */
import supertest from "supertest";
import app from "../../src/app.js";
import database from "../../src/database/index.js";

const agent = supertest(app);

describe("Transfer route behavior", () => {
  const BASE_URL = "/transfers";
  const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEwMDAwIiwibmFtZSI6IlVzZXIxIiwiZW1haWwiOiJ1c2VyQGVtYWlsLmNvbSJ9.KEriKNT1g5_0Zpbkc5fE9FaXpct7JKgfDrTjF1saWo4";

  beforeAll(async () => {
    await database.seed.run();
  });
  test("should get only users transfers", async () => {
    const { body, status } = await agent.get(BASE_URL)
      .set("authorization", `bearer ${TOKEN}`);

    expect(status).toBe(200);
    expect(body.length).toBe(1);
    expect(body[0].description).toBe("Transfer user 1");
  });

  describe("when create a new transfer...", () => {
    let transferId;
    let outgoing;
    let incoming;

    test("should return  201 code status and transfers values",
      async () => {
        const { body, status } = await agent.post(BASE_URL)
          .set("authorization", `bearer ${TOKEN}`)
          .send({
            description: "Regular transfer",
            user_id: 10000,
            acc_origin_id: 10000,
            acc_destiny_id: 10001,
            amount: 100,
            date: new Date(),
          });

        transferId = body.id;

        expect(status).toBe(201);
        expect(body.description).toBe("Regular transfer");
      });

    test("should generate equivalents transactions",
      async () => {
        const transactions = await database("transactions")
          .where({ transfer_id: transferId }).select();
        [outgoing, incoming] = transactions;
        expect(transactions).toHaveLength(2);
      });

    test("outgoing transactions should have negative values",
      () => {
        expect(outgoing.description).toBe("Transfer from origin acc 10000");
        expect(outgoing.amount).toBe("-100.00");
        expect(outgoing.acc_id).toBe(10000);
        expect(outgoing.type).toBe("O");
      });

    test("incoming transactions should have positive values", () => {
      expect(incoming.description).toBe("Transfer to destiny acc 10001");
      expect(incoming.amount).toBe("100.00");
      expect(incoming.acc_id).toBe(10001);
      expect(incoming.type).toBe("I");
    });

    test("Both transactions should references transfers id that generate",
      () => {
        expect(incoming.transfer_id).toBe(transferId);
        expect(outgoing.transfer_id).toBe(transferId);
      });

    test("Both transactions should have done status",
      () => {
        expect(incoming.status).toBe(true);
        expect(outgoing.status).toBe(true);
      });
  });

  describe("If register a invalid transfer it should...", () => {
    test("should not register a transfer without description",
      async () => {
        const { body, status } = await agent.post(BASE_URL)
          .set("authorization", `bearer ${TOKEN}`)
          .send(
            {
              user_id: 10000,
              acc_origin_id: 10000,
              acc_destiny_id: 10001,
              amount: 100,
              date: new Date(),
            },
          );

        expect(status).toBe(400);
        expect(body.error).toBe("Descrição é um atributo obrigatório");
      });

    test("should not register a transfer without amount",
      async () => {
        const { body, status } = await agent.post(BASE_URL)
          .set("authorization", `bearer ${TOKEN}`)
          .send(
            {
              description: "Regular transfer",
              user_id: 10000,
              acc_origin_id: 10000,
              acc_destiny_id: 10001,
              date: new Date(),
            },
          );

        expect(status).toBe(400);
        expect(body.error).toBe("Valor da transferência é um atributo obrigatório");
      });

    test("should not register a transfer without date",
      async () => {
        const { body, status } = await agent.post(BASE_URL)
          .set("authorization", `bearer ${TOKEN}`)
          .send(
            {
              description: "Regular transfer",
              user_id: 10000,
              acc_origin_id: 10000,
              acc_destiny_id: 10001,
              amount: 100,
            },
          );

        expect(status).toBe(400);
        expect(body.error).toBe("Data da transferência é um atributo obrigatório");
      });

    test("should not register a transfer without origin account",
      async () => {
        const { body, status } = await agent.post(BASE_URL)
          .set("authorization", `bearer ${TOKEN}`)
          .send(
            {
              description: "Regular transfer",
              user_id: 10000,
              acc_destiny_id: 10001,
              amount: 100,
              date: new Date(),
            },
          );

        expect(status).toBe(400);
        expect(body.error).toBe("ID da conta de origem é um atributo obrigatório");
      });

    test("should not register a transfer without destiny account",
      async () => {
        const { body, status } = await agent.post(BASE_URL)
          .set("authorization", `bearer ${TOKEN}`)
          .send(
            {
              description: "Regular transfer",
              user_id: 10000,
              acc_origin_id: 10000,
              amount: 100,
              date: new Date(),
            },
          );

        expect(status).toBe(400);
        expect(body.error).toBe("ID da conta destino é um atributo obrigatório");
      });

    test("should not register a transfer if origin and destiny acc are equal",
      async () => {
        const { body, status } = await agent.post(BASE_URL)
          .set("authorization", `bearer ${TOKEN}`)
          .send(
            {
              description: "Regular transfer",
              user_id: 10000,
              acc_origin_id: 10000,
              acc_destiny_id: 10000,
              amount: 100,
              date: new Date(),
            },
          );

        expect(status).toBe(400);
        expect(body.error).toBe("Não é possível transferir para a mesma conta");
      });

    test("should not register a transfer of another user",
      async () => {
        const { body, status } = await agent.post(BASE_URL)
          .set("authorization", `bearer ${TOKEN}`)
          .send(
            {
              description: "Regular transfer",
              user_id: 10000,
              acc_origin_id: 20000,
              acc_destiny_id: 10001,
              amount: 100,
              date: new Date(),
            },
          );

        expect(status).toBe(400);
        expect(body.error).toBe("Conta não pertence ao usuário");
      });
  });

  test("should get a transfer by ID", async () => {
    const { body, status } = await agent.get(`${BASE_URL}/10000`)
      .set("authorization", `bearer ${TOKEN}`);

    expect(body.description).toBe("Transfer user 1");
    expect(status).toBe(200);
  });

  describe("when update a valid transfer...", () => {
    let transferId;
    let outgoing;
    let incoming;

    test("should return  200 code status and transfers values",
      async () => {
        const { body, status } = await agent.put(`${BASE_URL}/10000`)
          .set("authorization", `bearer ${TOKEN}`)
          .send({
            description: "updated transfer",
            user_id: 10000,
            acc_origin_id: 10000,
            acc_destiny_id: 10001,
            amount: 500,
            date: new Date(),
          });

        transferId = body.id;

        expect(status).toBe(200);
        expect(body.description).toBe("updated transfer");
      });

    test("should generate equivalents transactions",
      async () => {
        const transactions = await database("transactions")
          .where({ transfer_id: transferId }).select();
        [outgoing, incoming] = transactions;
        expect(transactions).toHaveLength(2);
      });

    test("outgoing transactions should have negative values",
      () => {
        expect(outgoing.description).toBe("Transfer from origin acc 10000");
        expect(outgoing.amount).toBe("-500.00");
        expect(outgoing.acc_id).toBe(10000);
        expect(outgoing.type).toBe("O");
      });

    test("incoming transactions should have positive values", () => {
      expect(incoming.description).toBe("Transfer to destiny acc 10001");
      expect(incoming.amount).toBe("500.00");
      expect(incoming.acc_id).toBe(10001);
      expect(incoming.type).toBe("I");
    });

    test("Both transactions should references transfers id that generate",
      () => {
        expect(incoming.transfer_id).toBe(transferId);
        expect(outgoing.transfer_id).toBe(transferId);
      });
  });

  describe("When delete transfers...", () => {
    test("should return status code 204", async () => {
      const { status } = await agent.delete(`${BASE_URL}/10000`)
        .set("authorization", `bearer ${TOKEN}`);

      expect(status).toBe(204);
    });

    test("should be removed from database", async () => {
      const transferExists = await database("transfers")
        .where({ id: 10000 });

      expect(transferExists).toHaveLength(0);
    });

    test("should delete associate transactions", async () => {
      const transactionsExists = await database("transactions")
        .where({ transfer_id: 10000 });

      expect(transactionsExists).toHaveLength(0);
    });
  });

  test("should not get transfers of another user", async () => {
    const { body, status } = await agent.get(`${BASE_URL}/20000`)
      .set("authorization", `bearer ${TOKEN}`);

    expect(status).toBe(403);
    expect(body.error).toBe("Não autorizado");
  });
});
