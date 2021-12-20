import {
	InsightDataset,
	InsightDatasetKind,
	InsightError,
	NotFoundError,
	ResultTooLargeError
} from "../../src/controller/IInsightFacade";
import InsightFacade from "../../src/controller/InsightFacade";

import * as fs from "fs-extra";

import {testFolder} from "@ubccpsc310/folder-test";
import * as chai from "chai";
import {expect} from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);


describe("InsightFacade", function () {
	let insightFacade: InsightFacade;

	const persistDir = "./data";
	const datasetContents = new Map<string, string>();

	// Reference any datasets you've added to test/resources/archives here and they will
	// automatically be loaded in the 'before' hook.
	const datasetsToLoad: {[key: string]: string} = {
		courses: "./test/resources/archives/courses/courses.zip",
		rooms: "./test/resources/archives/rooms/rooms.zip",

		has0Sections: 	"./test/resources/archives/courses/0_sections.zip",
		has1Section: 	"./test/resources/archives/courses/1_section.zip",
		has3Sections:	"./test/resources/archives/courses/3_sections.zip",

		notAZip:		"./test/resources/archives/_not_a_zip.txt",

		emptyFile:		"./test/resources/archives/courses/empty_file.zip",
		noCoursesDir:	"./test/resources/archives/courses/no_courses_folder.zip",
		noValidJsonFiles:	 "./test/resources/archives/courses/no_valid_json_files.zip",
		someValidJsonFiles: "./test/resources/archives/courses/some_valid_json_files.zip",

		allInvalidSections:	"./test/resources/archives/courses/all_sections_invalid.zip",
		someInvalidSections_OneFile:	"./test/resources/archives/courses/some_sections_invalid.zip",
		someInvalidSections_MultipleFiles: "./test/resources/archives/courses/some_sections_invalid_multiple_files.zip",
		someInvalidSections_SomeFiles:	"./test/resources/archives/courses/some_files_contain_no_valid_sections.zip",
		someInvalidSections_AllFiles:	"./test/resources/archives/courses/all_files_contain_invalid_sections.zip",

		allMissingFields: "./test/resources/archives/courses/all_sections_missing_fields.zip",
		someMissingFields_OneFile: "./test/resources/archives/courses/some_sections_missing_fields.zip",
		someMissingFields_MultipleFiles: "./test/resources/archives/courses/some_sections_missing_fields_multiple_" +
			"files.zip",

		has34Rooms: "./test/resources/archives/rooms/34-rooms.zip",

		noIndexHtm: "./test/resources/archives/rooms/no-index-htm.zip",
		noIndexHtmInRoot: "./test/resources/archives/rooms/no-index-htm-in-root.zip",
		noRoomsDir: "./test/resources/archives/rooms/no-rooms-dir.zip",
		indexHtmNotHtml: "./test/resources/archives/rooms/index-htm-not-html.zip",

		multipleHtmFiles: "./test/resources/archives/rooms/multiple-htm-files-in-root.zip",
		buildingsDiffDirectoryStructure: "./test/resources/archives/rooms/buildings-diff-directory-structure.zip",

		noValidRooms: "./test/resources/archives/rooms/no-valid-rooms.zip",
		someInvalidRooms: "./test/resources/archives/rooms/some-invalid-rooms.zip",

		noBuildingsTable: "./test/resources/archives/rooms/no-buildings-table.zip",
		noBuildings: "./test/resources/archives/rooms/no-buildings.zip",
		noBuildingsHaveAddresses: "./test/resources/archives/rooms/no-buildings-have-addresses.zip",
		someBuildingsHaveAddresses: "./test/resources/archives/rooms/some-buildings-have-addresses.zip",
		noBuildingsHaveFiles: "./test/resources/archives/rooms/no-buildings-point-to-files.zip",
		someBuildingsHaveFiles: "./test/resources/archives/rooms/some-buildings-point-to-files.zip",
		noBuildingsHaveRooms: "./test/resources/archives/rooms/buildings-all-have-no-rooms.zip",

		geolocationError: "./test/resources/archives/rooms/geolocation-error.zip",
	};

	const getDatasetContent = function (key: string): string {
		const content = datasetContents.get(key);

		if (content === undefined) {
			expect.fail("Could not find contents of dataset with key \"" + key + "\"");
		}

		return content;
	};

	before(function () {
		// This section runs once and loads all datasets specified in the datasetsToLoad object
		for (const key of Object.keys(datasetsToLoad)) {
			const content = fs.readFileSync(datasetsToLoad[key]).toString("base64");
			datasetContents.set(key, content);
		}
		// Just in case there is anything hanging around from a previous run
		fs.removeSync(persistDir);
	});

	describe("Add/Remove/List Dataset", function () {
		before(function () {
			// console.info(`Before: ${this.test?.parent?.title}`);
		});

		beforeEach(function () {
			// This section resets the insightFacade instance
			// This runs before each test
			// console.info(`BeforeTest: ${this.currentTest?.title}`);
			insightFacade = new InsightFacade();
		});

		after(function () {
			// console.info(`After: ${this.test?.parent?.title}`);
		});

		afterEach(function () {
			// This section resets the data directory (removing any cached data)
			// This runs after each test, which should make each test independent from the previous one
			// console.info(`AfterTest: ${this.currentTest?.title}`);
			fs.removeSync(persistDir);
		});

		// This is a unit test. You should create more like this!
		// it("Should add a valid dataset", function () {
		// 	const id: string = "courses";
		// 	const content: string = datasetContents.get("courses") ?? "";
		// 	const expected: string[] = [id];
		// 	return insightFacade.addDataset(id, content, InsightDatasetKind.Courses).then((result: string[]) => {
		// 		expect(result).to.deep.equal(expected);
		// 	});
		// });

		// region Add Dataset
		function testSuccessfullyAddOneDataset(datasetKey: string, id: string, numRows: number,
			datasetKind: InsightDatasetKind) {
			const content = getDatasetContent(datasetKey);

			const promise = insightFacade.addDataset(id, content, datasetKind);

			return promise
				.then((datasetIDs) => {
					expect(datasetIDs).to.have.lengthOf(1);
					expect(datasetIDs).to.deep.contain(id);
					expect(datasetIDs).to.be.an.instanceof(Array);
				})
				.then(() => insightFacade.listDatasets())
				.then((datasets) => {
					expect(datasets).to.have.lengthOf(1);
					expect(datasets).to.deep.contain({
						id: id,
						kind: datasetKind,
						numRows: numRows
					});
				});
		}

		async function testFailToAddDataset(datasetKey: string, id: string, kind: InsightDatasetKind) {
			const content: string = getDatasetContent(datasetKey);

			try {
				await insightFacade.addDataset(id, content, kind);
				expect.fail("Did not reject with InsightError.");
			} catch (error) {
				expect(error).to.be.instanceOf(InsightError);
			}

			// Check that the bad dataset was not added
			// todo: may want to remove before initial testing while listDatsets is not implemented
			const currentDatasets: InsightDataset[] = await insightFacade.listDatasets();
			expect(currentDatasets).to.be.empty;
		}

		it("should reject if the id already exists", async function() {
			// Add the first dataset. Abort if it fails.
			const id = "idDuplicate";
			const content1: string = getDatasetContent("has1Section");

			try {
				await insightFacade.addDataset(id, content1, InsightDatasetKind.Courses);
			} catch (error) {
				expect.fail("An unexpected error occurred when adding the first dataset: " + error);
			}

			// Add the second dataset
			const content2: string = getDatasetContent("has0Sections");

			return insightFacade.addDataset(id, content2, InsightDatasetKind.Courses)
				.catch((error) => expect(error).to.be.instanceOf(InsightError))
				.then(() => insightFacade.listDatasets())
				.then((datasets) => {
					expect(datasets).to.have.lengthOf(1);
					expect(datasets[0]).to.deep.equal({
						id: id,
						kind: InsightDatasetKind.Courses,
						numRows: 1
					});
				});
		});

		it("should add a dataset with 1 section, valid", function() {
			return testSuccessfullyAddOneDataset("has1Section", "id1Section", 1, InsightDatasetKind.Courses);
		});

		it("should add a dataset with multiple sections, all valid", function() {
			return testSuccessfullyAddOneDataset("has3Sections", "id3Sections", 3, InsightDatasetKind.Courses);
		});

		it("should reject if the id contains an underscore", function() {
			return testFailToAddDataset("has0Sections", "bad_ID", InsightDatasetKind.Courses);
		});

		it("should reject if the id is all whitespace", function() {
			return testFailToAddDataset("has0Sections", " \t      ", InsightDatasetKind.Courses);
		});

		it("should reject if the input is not a zip", function() {
			return testFailToAddDataset("notAZip", "idNotZip", InsightDatasetKind.Courses);
		});

		it("should reject if a courses dataset has no courses/ directory", function() {
			return testFailToAddDataset("noCoursesDir", "idNoCoursesDir", InsightDatasetKind.Courses);
		});

		it("should reject if the only file is empty", function() {
			return testFailToAddDataset("emptyFile", "idEmptyFile", InsightDatasetKind.Courses);
		});

		it("should reject if the file has 0 sections", function() {
			return testFailToAddDataset("has0Sections", "id0Sections", InsightDatasetKind.Courses);
		});

		it("should reject if no file is valid JSON", function() {
			return testFailToAddDataset("noValidJsonFiles", "idInvalidJson", InsightDatasetKind.Courses);
		});

		it("should only add files that are valid JSON", function() {
			return testSuccessfullyAddOneDataset("someValidJsonFiles", "idJSONOnly", 1, InsightDatasetKind.Courses);
		});

		// region Additional tests for valid sections
		it("should reject if no file contains a valid section", function() {
			return testFailToAddDataset("allInvalidSections", "idValidSections1", InsightDatasetKind.Courses);
		});

		it("should only add the valid sections when one of the files has no valid sections", function() {
			return testSuccessfullyAddOneDataset("someInvalidSections_SomeFiles", "idValidSections2",
				2, InsightDatasetKind.Courses);
		});

		it("should only add the valid sections, in a single file", function() {
			return testSuccessfullyAddOneDataset("someInvalidSections_OneFile", "idValidSections3",
				1, InsightDatasetKind.Courses);
		});

		it("should only add the valid sections, in multiple files", function() {
			return testSuccessfullyAddOneDataset("someInvalidSections_MultipleFiles", "idValidSections4",
				2, InsightDatasetKind.Courses);
		});

		it("should only add the valid sections when every file contains some invalid sections", function() {
			return testSuccessfullyAddOneDataset("someInvalidSections_AllFiles", "idValidSections5",
				2, InsightDatasetKind.Courses);
		});
		// endregion

		// region Additional tests for required fields in sections
		it("should reject if the section has incomplete fields", function() {
			return testFailToAddDataset("allMissingFields", "idIncompleteFields1", InsightDatasetKind.Courses);
		});

		it("should add only sections without incomplete fields, in a single file", function() {
			return testSuccessfullyAddOneDataset("someMissingFields_OneFile", "idIncompleteFields2",
				3, InsightDatasetKind.Courses);
		});

		it("should add only sections without incomplete fields, in multiple files", function() {
			return testSuccessfullyAddOneDataset("someMissingFields_MultipleFiles", "idIncompleteFields3",
				3, InsightDatasetKind.Courses);
		});
		// endregion

		it("should reject when a dataset has an improper dir name, not courses", function() {
			return testFailToAddDataset("rooms", "improperDirNameRooms", InsightDatasetKind.Courses);
		});

		it("should be able to add 5 courses datasets", async function() {
			const datasetKeys: string[] = [
				"has1Section",
				"has1Section",
				"has3Sections",
				"someValidJsonFiles",
				"has3Sections"
			];
			const rowCounts: number[] = [1, 1, 3, 1, 3];
			const ids: string[] = ["Dataset1Of5", "Dataset2Of5", "Dataset3Of5", "Dataset4Of5", "Dataset5Of5"];

			let currDatasets: InsightDataset[] = [];

			for (let i = 0; i < 5; i++) {
				// Get the content of the file and add the dataset
				const content: string = getDatasetContent(datasetKeys[i]);
				const datasetIDs: string[] = await insightFacade.addDataset(ids[i], content,
					InsightDatasetKind.Courses);

				// Keep track of datasets added so far
				currDatasets.push({
					id: ids[i],
					kind: InsightDatasetKind.Courses,
					numRows: rowCounts[i]
				});

				// Check that IDs of all previously added datasets are returned
				expect(datasetIDs).to.have.lengthOf(currDatasets.length);
				for (let j = 0; j <= i; j++) {
					expect(datasetIDs).to.include(ids[j]);
				}

				// List all current datasets
				const listedDatasets: InsightDataset[] = await insightFacade.listDatasets();

				// Check that information of all added datasets is correct
				expect(listedDatasets).to.have.lengthOf(currDatasets.length);
				expect(listedDatasets).to.have.deep.members(currDatasets);
			}
		});

		it("should reject if a rooms dataset is added with kind Courses", function() {
			return testFailToAddDataset("has34Rooms", "RoomsAddedAsCourses", InsightDatasetKind.Courses);
		});

		it("should reject if a courses dataset is added with kind Rooms", function() {
			return testFailToAddDataset("has3Sections", "CoursesAddedAsRooms", InsightDatasetKind.Rooms);
		});

		it("should reject if a rooms dataset has no rooms/ directory", function () {
			return testFailToAddDataset("noRoomsDir", "NoRoomsDir", InsightDatasetKind.Rooms);
		});

		it("should reject if there is no rooms/index.htm file in a rooms dataset", function() {
			return testFailToAddDataset("noIndexHtm", "NoIndexHtm", InsightDatasetKind.Rooms);
		});

		it("should reject if index.htm is in a subdirectory of rooms/ in a rooms dataset", function() {
			return testFailToAddDataset("noIndexHtmInRoot", "NoIndexHtmInRoot", InsightDatasetKind.Rooms);
		});

		it("should only add rooms from buildings in the index.htm file in a rooms dataset", function() {
			return testSuccessfullyAddOneDataset("multipleHtmFiles", "MultipleHtmFiles", 34, InsightDatasetKind.Rooms);
		});

		it("should reject if index.htm is not valid HTML", function() {
			return testFailToAddDataset("indexHtmNotHtml", "InvalidHtml", InsightDatasetKind.Rooms);
		});

		it("should reject if the HTML table containing buildings is not present", function() {
			return testFailToAddDataset("noBuildingsTable", "NoBuildingsTable", InsightDatasetKind.Rooms);
		});

		it("should reject if index.htm has 0 buildings in the table", function() {
			return testFailToAddDataset("noBuildings", "0Buildings", InsightDatasetKind.Rooms);
		});

		it("should reject if the dataset contains buildings but no rooms", function() {
			return testFailToAddDataset("noBuildingsHaveRooms", "0Rooms", InsightDatasetKind.Rooms);
		});

		it("should reject if the dataset contains no valid rooms", function() {
			return testFailToAddDataset("noValidRooms", "NoValidRooms", InsightDatasetKind.Rooms);
		});

		it("should only add valid rooms if some rooms are invalid", function() {
			return testSuccessfullyAddOneDataset("someInvalidRooms", "SomeInvalidRooms", 31, InsightDatasetKind.Rooms);
		});

		it("should successfully add if the buildings are in different folders", function() {
			return testSuccessfullyAddOneDataset("buildingsDiffDirectoryStructure", "DifferentFolders", 34,
				InsightDatasetKind.Rooms);
		});

		it("should reject if no buildings have addresses", function() {
			return testFailToAddDataset("noBuildingsHaveAddresses", "NoAddresses", InsightDatasetKind.Rooms);
		});

		it("should only add rooms in buildings whose addresses can be found", function() {
			return testSuccessfullyAddOneDataset("someBuildingsHaveAddresses", "SomeBuildingsHaveAddresses", 27,
				InsightDatasetKind.Rooms);
		});

		it("should reject if there are no buildings whose building files can be found", function() {
			return testFailToAddDataset("noBuildingsHaveFiles", "NoBuildingsHaveFiles", InsightDatasetKind.Rooms);
		});

		it("should only add rooms in buildings whose building files can be found", function() {
			return testSuccessfullyAddOneDataset("someBuildingsHaveFiles", "SomeBuildingsHaveFiles", 26,
				InsightDatasetKind.Rooms);
		});

		it("should reject if the only building results in a geolocation error", function() {
			return testFailToAddDataset("geolocationError", "GeolocationError", InsightDatasetKind.Rooms);
		});

		it("should successfully add one rooms dataset", function() {
			return testSuccessfullyAddOneDataset("has34Rooms", "ValidRooms", 34, InsightDatasetKind.Rooms);
		});

		// endregion

		// region Remove Dataset
		// All the tests will use 3_sections.zip
		async function addOneDataset(id: string) {
			try {
				const content = getDatasetContent("has3Sections");

				await insightFacade.addDataset(id, content, InsightDatasetKind.Courses);
			} catch (error) {
				expect.fail("An unexpected error occurred when adding the dataset: " + error);
			}
		}

		// All the tests below use 3_sections.zip, so the numRows = 3
		async function checkNoDatasetsWereRemoved(id: string) {
			const remainingDatasets: InsightDataset[] = await insightFacade.listDatasets();
			expect(remainingDatasets).to.have.lengthOf(1);
			expect(remainingDatasets).to.deep.include({
				id: id,
				kind: InsightDatasetKind.Courses,
				numRows: 3
			});
		}

		async function testRemoveDatasetWithInvalidId(goodID: string, badID: string) {
			// Set up: add a dataset
			await addOneDataset(goodID);

			// Attempt to remove a dataset with invalid id
			try {
				await insightFacade.removeDataset(badID);
				expect.fail("Did not reject with InsightError.");
			} catch (error) {
				expect(error).to.be.instanceOf(InsightError);
			}

			await checkNoDatasetsWereRemoved(goodID);
		}

		it("should remove a single dataset with valid id", async function() {
			const id: string = "RemoveDataset1";

			// Set up: add a dataset
			await addOneDataset(id);

			// Attempt to remove the dataset
			const returnedId: string = await insightFacade.removeDataset(id);
			expect(returnedId).to.equal(id);

			const remainingDatasets: InsightDataset[] = await insightFacade.listDatasets();
			expect(remainingDatasets).to.have.lengthOf(0);
		});

		it("should reject with NotFoundError if given a valid id that has not been added", async function() {
			const id: string = "RemoveDataset2";

			// Set up: add a dataset
			await addOneDataset(id);

			// Attempt to remove a dataset with different id
			try {
				await insightFacade.removeDataset("NotAdded");
				expect.fail("Did not reject with NotFoundError.");
			} catch (error) {
				expect(error).to.be.instanceOf(NotFoundError);
			}

			await checkNoDatasetsWereRemoved(id);
		});

		it("should reject with InsightError if the id contains underscores", async function() {
			await testRemoveDatasetWithInvalidId("RemoveDataset3", "bad_id");
		});

		it("should reject with InsightError if the id is all whitespace", async function() {
			await testRemoveDatasetWithInvalidId("RemoveDataset4", "   \t  ");
		});

		it("should catch a InsightError for removing when list is empty", function () {
			let result = insightFacade.removeDataset("");

			return expect(result).eventually.to.be.rejectedWith(InsightError);
		});

		// endregion

		// region List Datasets
		it("should return an empty array when there are 0 datasets", function() {
			return insightFacade.listDatasets()
				.then((datasets) => {
					expect(datasets).to.be.empty;
				});
		});

		it("should return 1 dataset after 1 dataset is added", async function() {
			const id = "ListDatasets1";
			try {
				const content = getDatasetContent("has3Sections");
				await insightFacade.addDataset(id, content, InsightDatasetKind.Courses);
			} catch (error) {
				expect.fail("An unexpected error occurred when adding the dataset: " + error);
			}

			const datasets: InsightDataset[] = await insightFacade.listDatasets();
			expect(datasets).to.have.lengthOf(1);
			expect(datasets).to.deep.include({
				id: id,
				kind: InsightDatasetKind.Courses,
				numRows: 3
			});
		});

		it("should return 3 datasets after 3 datasets are added", async function() {
			const ids: string[] = ["ListDatasets1", "ListDatasets2", "ListDatasets3"];
			const datasetKeys: string[] = ["has3Sections", "has3Sections", "has1Section"];
			const rows: number[] = [3, 3, 1];

			try {
				for (let i = 0; i < 3; i++) {
					const content = getDatasetContent(datasetKeys[i]);
					await insightFacade.addDataset(ids[i], content, InsightDatasetKind.Courses);
				}
			} catch (error) {
				expect.fail("An unexpected error occurred when adding 3 datasets: " + error);
			}

			const datasets: InsightDataset[] = await insightFacade.listDatasets();
			expect(datasets).to.have.lengthOf(ids.length);
			expect(datasets).to.have.deep.members([
				{
					id: ids[0],
					kind: InsightDatasetKind.Courses,
					numRows: rows[0]
				},
				{
					id: ids[1],
					kind: InsightDatasetKind.Courses,
					numRows: rows[1]
				},
				{
					id: ids[2],
					kind: InsightDatasetKind.Courses,
					numRows: rows[2]
				}]
			);
		});

		// endregion

		it("should check for any datasets that exist on disk when re-instantiated", async function() {
			const ids = ["coursesSmall", "roomsSmall"];
			const keys = ["has3Sections", "has34Rooms"];
			const kinds = [InsightDatasetKind.Courses, InsightDatasetKind.Rooms];
			const numRows = [3, 34];

			const loadDatasetPromises: Array<Promise<string[]>> = [
				insightFacade.addDataset(ids[0], datasetContents.get(keys[0]) ?? "", kinds[0]),
				insightFacade.addDataset(ids[1], datasetContents.get(keys[1]) ?? "", kinds[1]),
			];

			await Promise.all(loadDatasetPromises);

			insightFacade = new InsightFacade();

			const datasets: InsightDataset[] = await insightFacade.listDatasets();
			expect(datasets).to.have.deep.members([
				{
					id: ids[0],
					kind: kinds[0],
					numRows: numRows[0]
				},
				{
					id: ids[1],
					kind: kinds[1],
					numRows: numRows[1]
				}
			]);
		});
	});

	/*
	 * This test suite dynamically generates tests from the JSON files in test/queries.
	 * You should not need to modify it; instead, add additional files to the queries directory.
	 * You can still make tests the normal way, this is just a convenient tool for a majority of queries.
	 */
	describe("PerformQuery", () => {
		before(function () {
			console.info(`Before: ${this.test?.parent?.title}`);

			insightFacade = new InsightFacade();

			// Load the datasets specified in datasetsToQuery and add them to InsightFacade.
			// Will *fail* if there is a problem reading ANY dataset.
			const loadDatasetPromises = [
				insightFacade.addDataset("courses", datasetContents.get("courses") ?? "", InsightDatasetKind.Courses),
				insightFacade.addDataset("rooms", datasetContents.get("rooms") ?? "", InsightDatasetKind.Rooms),
			];

			return Promise.all(loadDatasetPromises);
		});

		after(function () {
			console.info(`After: ${this.test?.parent?.title}`);
			fs.removeSync(persistDir);
		});

		type PQErrorKind = "ResultTooLargeError" | "InsightError";

		const errorValidator = function(error: any): error is PQErrorKind {
			return error === "ResultTooLargeError" || error === "InsightError";
		};

		const assertOnError = function(expected: PQErrorKind, actual: any) {
			if (expected === "ResultTooLargeError") {
				expect(actual).to.be.instanceof(ResultTooLargeError);
			} else {
				expect(actual).to.be.instanceof(InsightError);
			}
		};

		testFolder<any, any[], PQErrorKind>(
			"Dynamic InsightFacade PerformQuery tests (unordered results)",
			(input) => insightFacade.performQuery(input),
			"./test/resources/queries/unordered",
			{
				errorValidator: errorValidator,
				assertOnError: assertOnError,
				assertOnResult (expected, actual) {
					expect(actual).to.have.deep.members(expected);
				}
			}
		);

		testFolder<any, any[], PQErrorKind>(
			"Dynamic InsightFacade PerformQuery tests (ordered results)",
			(input) => insightFacade.performQuery(input),
			"./test/resources/queries/ordered",
			{
				errorValidator: errorValidator,
				assertOnError: assertOnError,
				assertOnResult (expected, actual) {
					expect(actual).to.have.deep.ordered.members(expected);
				}
			}
		);

		testFolder<any, any[], PQErrorKind>(
			"Dynamic PerformQuery tests for C2 (unordered results)",
			(input) => insightFacade.performQuery(input),
			"./test/resources/queries/c2_unordered",
			{
				errorValidator: errorValidator,
				assertOnError: assertOnError,
				assertOnResult (expected, actual) {
					expect(actual).to.have.deep.members(expected);
				}
			}
		);

		testFolder<any, any[], PQErrorKind>(
			"Dynamic PerformQuery tests for C2 (ordered results)",
			(input) => insightFacade.performQuery(input),
			"./test/resources/queries/c2_ordered",
			{
				errorValidator: errorValidator,
				assertOnError: assertOnError,
				assertOnResult (expected, actual) {
					expect(actual).to.have.deep.ordered.members(expected);
				}
			}
		);

		it("should reject if the query references more than 1 existing dataset", async function() {
			const content = getDatasetContent("has1Section");
			await insightFacade.addDataset("courses2", content, InsightDatasetKind.Courses);

			const query = {
				WHERE:{
					IS:{
						courses_instructor: "taylor, jared"
					}
				},
				OPTIONS:{
					COLUMNS:[
						"courses_instructor",
						"courses2_title"
					]
				}
			};

			try {
				await insightFacade.performQuery(query);
				expect.fail("Did not throw InsightError");
			} catch (error) {
				expect(error).to.be.instanceOf(InsightError);
			}
		});
	});
});
