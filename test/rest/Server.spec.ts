import Server from "../../src/rest/Server";
import chai, {expect} from "chai";
import chaiHttp from "chai-http";
import * as fs from "fs-extra";
import {InsightDatasetKind} from "../../src/controller/IInsightFacade";
import {Response} from "superagent";

chai.use(chaiHttp);

const PORT = 4321;
const SERVER_URL = `http://localhost:${PORT}`;

const persistDir = "./data";

describe("C3 REST API", function () {
	// let facade: InsightFacade;
	let server: Server;

	const datasetPaths: { [key: string]: string } = {
		courses: "./test/resources/archives/courses/courses.zip",
		coursesSmall: "./test/resources/archives/courses/3_sections.zip",
		roomsSmall: "./test/resources/archives/rooms/34-rooms.zip",

		testImage: "./test/resources/archives/test-image.png",
	};

	const clearDatasetsOnDisk = function (): void {
		fs.removeSync(persistDir);
	};

	const getFileContent = function (filePath: string): any {
		return fs.readFileSync(filePath).toString();
	};

	before(function () {
		// facade = new InsightFacade();
		server = new Server(PORT);

		clearDatasetsOnDisk();		// just in case

		// TODO: start server here once and handle errors properly
		return server.start();
	});

	after(function () {
		// TODO: stop server here once!
		return server.stop();
	});

	// beforeEach(function () {
	// 	// might want to add some process logging here to keep track of what"s going on
	// });
	//
	// afterEach(function () {
	// 	// might want to add some process logging here to keep track of what"s going on
	// });

	describe("GET/PUT/DELETE tests", function() {
		beforeEach(function () {
			server.newInsightFacade();
		});

		afterEach(function () {
			clearDatasetsOnDisk();
		});

		it("PUT test with one valid courses dataset", function () {
			const id = "courses";
			const kind = InsightDatasetKind.Courses;
			const key = "coursesSmall";

			return sendPutRequestDataset(id, kind, key)
				.then(function (res) {
					const resultArr = expectSuccessAndGetResultBody(res);

					expect(resultArr).to.have.members([id]);
				});
		});

		it("PUT test with one valid rooms dataset", function () {
			const id = "rooms";
			const kind = InsightDatasetKind.Rooms;
			const key = "roomsSmall";

			return sendPutRequestDataset(id, kind, key)
				.then(function (res) {
					const resultArr = expectSuccessAndGetResultBody(res);

					expect(resultArr).to.have.members([id]);
				});
		});

		it("PUT test with invalid dataset content", function () {
			const id = "rooms";
			const kind = InsightDatasetKind.Rooms;
			const key = "coursesSmall";

			return sendPutRequestDataset(id, kind, key)
				.then(function (res) {
					expectError(res, 400);
				});
		});

		it("PUT test with invalid dataset ID", function () {
			const id = "_courses";
			const kind = InsightDatasetKind.Courses;
			const key = "coursesSmall";

			return sendPutRequestDataset(id, kind, key)
				.then(function (res) {
					expectError(res, 400);
				});
		});

		it("PUT test with invalid dataset kind", function () {
			const id = "test5324";
			const kind = "course";
			const key = "coursesSmall";

			return sendPutRequestDataset(id, kind, key)
				.then(function (res) {
					expectError(res, 400);
				});
		});

		it("should throw error if PUT request body is empty", function () {
			const id = "test093";
			const kind = InsightDatasetKind.Courses;

			return chai.request(SERVER_URL)
				.put(`${Server.PUT_ENDPOINT}/${id}/${kind}`)
				.send()
				.set("Content-Type", "application/x-zip-compressed")
				.then(function (res) {
					expectError(res, 400);
				});
		});

		it("should throw error if PUT body is not a zip file", function () {
			const id = "test250";
			const kind = InsightDatasetKind.Courses;
			const key = "testImage";

			return sendPutRequestDataset(id, kind, key)
				.then(function (res) {
					expectError(res, 400);
				});
		});

		it("DELETE test on an existing dataset", async function () {
			const id = "rooms";
			await sendPutRequestDataset(id, InsightDatasetKind.Rooms, "roomsSmall");

			return chai.request(SERVER_URL)
				.delete(`${Server.DELETE_ENDPOINT}/${id}`)
				.then(function (res) {
					const resultString = expectSuccessAndGetResultBody(res);

					expect(resultString).to.be.a("string");
					expect(resultString).to.equal(id);
				});
		});

		it("DELETE test on a non-existent dataset", function () {
			const id = "rooms";

			return chai.request(SERVER_URL)
				.delete(`${Server.DELETE_ENDPOINT}/${id}`)
				.then(function (res) {
					expectError(res, 404);
				});
		});

		it("DELETE test on an invalid dataset ID", async function () {
			const invalidId = "rooms_dataset";

			await sendPutRequestDataset("rooms", InsightDatasetKind.Rooms, "roomsSmall");

			return chai.request(SERVER_URL)
				.delete(`${Server.DELETE_ENDPOINT}/${invalidId}`)
				.then(function (res) {
					expectError(res, 400);
				});
		});

		it("GET test with 2 datasets", async function () {
			const coursesId = "courses";
			const roomsId = "rooms";

			const addDatasetRequests: Array<Promise<Response>> = [
				sendPutRequestDataset(coursesId, InsightDatasetKind.Courses, "coursesSmall"),
				sendPutRequestDataset(roomsId, InsightDatasetKind.Rooms, "roomsSmall")
			];
			await Promise.all(addDatasetRequests);

			return chai.request(SERVER_URL)
				.get(Server.GET_ENDPOINT)
				.then(function (res) {
					const resultArr = expectSuccessAndGetResultBody(res);
					expect(resultArr).to.have.deep.members([
						{
							id: coursesId,
							kind: InsightDatasetKind.Courses,
							numRows: 3
						},
						{
							id: roomsId,
							kind: InsightDatasetKind.Rooms,
							numRows: 34
						}
					]);
				});
		});
	});

	describe("POST tests", function() {
		before( async function() {
			// Just in case
			clearDatasetsOnDisk();

			server.newInsightFacade();

			// Add large dataset once, to be used in all queries
			await sendPutRequestDataset("courses", InsightDatasetKind.Courses, "courses");

			console.log("POST tests before: added courses dataset");
		});

		after(async function() {
			// Only delete after running all queries
			clearDatasetsOnDisk();
		});

		it("should throw error on POST test with empty body", function() {
			return chai.request(SERVER_URL)
				.post(Server.POST_ENDPOINT)
				.type("json")
				.send()
				.then(function (res) {
					expectError(res, 400);
				});
		});

		it("POST test on a valid query", async function () {
			const query = getFileContent("./test/resources/queries/c3/valid_query_AVG.json");
			const expected = getFileContent("./test/resources/queries/c3/valid_query_AVG_result.json");
			const expectedArray = JSON.parse(expected);

			return sendPostRequestQuery(query)
				.then(function (res) {
					const resultArr = expectSuccessAndGetResultBody(res);

					expect(resultArr).to.be.an("array");
					expect(resultArr).to.have.deep.members(expectedArray);
				});
		});

		it("POST test on an invalid query", async function () {
			const query = getFileContent("./test/resources/queries/c3/invalid_query.json");

			return sendPostRequestQuery(query)
				.then(function (res) {
					expectError(res, 400);
				});
		});

		it("POST test on a nonexistent dataset", async function() {
			const query = getFileContent("./test/resources/queries/c3/query_no_dataset.json");

			return sendPostRequestQuery(query)
				.then(function (res) {
					expectError(res, 400);
				});
		});

		it("POST test with too large result", async function() {
			const query = getFileContent("./test/resources/queries/c3/query_result_too_large.json");

			return sendPostRequestQuery(query)
				.then(function (res) {
					expectError(res, 400);
				});
		});
	});

	function expectError(res: Response, statusCode: number): void {
		console.log(res.body);

		expect(res).to.have.status(statusCode);

		expect(res.body).to.be.an("object").that.has.keys("error");
		expect(res.body["error"]).to.be.a("string");
	}

	function expectSuccessAndGetResultBody(res: Response): any {
		console.log(res.body);

		const successStatusCode = 200;
		expect(res).to.have.status(successStatusCode);

		expect(res.body).to.be.an("object").that.has.keys("result");

		return res.body["result"];
	}

	async function sendPutRequestDataset(id: string, kind: string, key: string): Promise<Response> {
		const content: Buffer = fs.readFileSync(datasetPaths[key]);

		return chai.request(SERVER_URL)
			.put(`${Server.PUT_ENDPOINT}/${id}/${kind}`)
			.send(content)
			.set("Content-Type", "application/x-zip-compressed");
	}

	async function sendPostRequestQuery(query: any): Promise<Response> {
		return chai.request(SERVER_URL)
			.post(Server.POST_ENDPOINT)
			.type("json")
			.send(query);
	}

	// Sample on how to format PUT requests
	/*
	it("PUT test for courses dataset", function () {
		try {
			return chai.request(SERVER_URL)
				.put(ENDPOINT_URL)
				.send(ZIP_FILE_DATA)
				.set("Content-Type", "application/x-zip-compressed")
				.then(function (res: Response) {
					// some logging here please!
					expect(res.status).to.be.equal(200);
				})
				.catch(function (err) {
					// some logging here please!
					expect.fail();
				});
		} catch (err) {
			// and some more logging here!
		}
	});
	*/

	// The other endpoints work similarly. You should be able to find all instructions at the chai-http documentation
});
