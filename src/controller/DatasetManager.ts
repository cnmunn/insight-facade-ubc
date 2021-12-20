import {InsightDataset, InsightDatasetKind, InsightError, NotFoundError} from "./IInsightFacade";
import {CourseSection, RoomsSection} from "./ICourseSection";
import JSZip from "jszip";
import fs from "fs";
import BuildingProcessor, {BuildingInfo} from "./BuildingProcessor";

const parse5 = require("parse5");
const sectionProperties = ["Course", "Subject", "Title", "Professor", "id", "Year", "Audit", "Pass", "Fail", "Avg"];
const DATA_DIR = "./data/";

export default class DatasetManager {
	public datasets: InsightDataset[];

	/**
	 * Constructor. Will check for existing datasets in {@link DATA_DIR} and load their information.
	 */
	constructor() {
		this.datasets = [];
		this.loadAnyDatasetsOnDisk();
	}

	private loadAnyDatasetsOnDisk() {
		if (fs.existsSync(DATA_DIR)) {
			const datasetFiles: string[] = fs.readdirSync(DATA_DIR);

			for (const fileName of datasetFiles) {
				if (DatasetManager.isDatasetFile(fileName)) {
					const datasetInfo: InsightDataset = DatasetManager.parseFileName(fileName);

					this.datasets.push(datasetInfo);
				}
			}
		}
	}

	/**
	 * Returns the kind of the dataset with given id. If the dataset does not exist, throws an InsightError.
	 */
	public getKindOfDataset(id: string): InsightDatasetKind {
		const dataset = this.findDatasetWithId(id);

		if (dataset) {
			return dataset.kind;
		} else {
			throw new InsightError("Dataset does not exist");
		}
	}

	public async addCoursesDataset(id: string, content: string): Promise<string[]>{
		try {
			const courseSectionList: CourseSection[] = await this.readCoursesContent(content);

			const numRows = courseSectionList.length;
			const dataset: InsightDataset = {id, kind: InsightDatasetKind.Courses, numRows};
			this.datasets.push(dataset);

			this.writeDatasetContents(dataset, courseSectionList);

			return this.idsOfCurrentDatasets();
		} catch (err) {
			throw new InsightError("Error adding the dataset - " + err);
		}
	}

	public async addRoomsDataset(id: string, content: string): Promise<string[]>{
		try {
			const roomsSectionList: RoomsSection[] = await this.readRoomsContent(content);

			const numRows = roomsSectionList.length;
			const dataset: InsightDataset = {id, kind: InsightDatasetKind.Rooms, numRows};
			this.datasets.push(dataset);

			this.writeDatasetContents(dataset, roomsSectionList);

			return this.idsOfCurrentDatasets();
		} catch (err) {
			throw new InsightError("Error adding the dataset - " + err);
		}
	}

	private async readRoomsContent(content: string): Promise<RoomsSection[]> {
		let zip = new JSZip();
		let roomsSectionList: RoomsSection[] = [];
		let jszip = await zip.loadAsync(content, {base64: true});

		let htmlContent;
		try {
			htmlContent = await jszip.folder("rooms")?.file("index.htm")?.async("string");
		} catch (e) {
			return Promise.reject(new InsightError("Contents not a zip file"));
		}

		if (htmlContent) {
			const document = parse5.parse(htmlContent);
			let buildingProcessor: BuildingProcessor = new BuildingProcessor();
			let buildings: BuildingInfo[] = await buildingProcessor.getBuildingInfo(document);
			if(buildings.length === 0){
				return Promise.reject(new InsightError("No valid buildings"));
			}
			for (let building of buildings) {
				let rooms: RoomsSection[] = [];

				rooms = await buildingProcessor.getRoomsForBuilding(building, jszip);
				// console.log(rooms);
				roomsSectionList.push(...rooms);
			}
		}

		if(roomsSectionList.length > 0){
			return Promise.resolve(roomsSectionList);
		}else{
			return Promise.reject(new InsightError());
		}
	}

	private async readCoursesContent(content: string): Promise<CourseSection[]> {

		let zip = new JSZip();
		let promiseArr: Array<Promise<string>> = new Array<Promise<string>>();
		let courseSectionList: CourseSection[] = [];

		try{
			let jszip = await zip.loadAsync(content, {base64 : true});

			jszip.folder("courses")?.forEach(function (relativePath, file) {
				// fileContent is JSON!
				promiseArr.push(file.async("string"));
			});
		}catch (e) {
			return Promise.reject(new InsightError("Contents not a zip file"));
		}

		let courseContents: string[] = await Promise.all(promiseArr);

		for (let course of courseContents) {
			try{

				const courseObj = JSON.parse(course);	// each object is a course

				if (Array.isArray(courseObj["result"])) {
					const sections = courseObj["result"];

					for (let sectionObj of sections) {

						let properties: string[] = Object.keys(sectionObj);

						if (sectionProperties.every((property) => properties.includes(property))) {
							// Add section to sectionList
							let section = this.parseCourseSection(sectionObj);
							courseSectionList.push(section);
						}
						// Otherwise, skip this section
					}
				}
			}catch(e){
				// continue;
			}
		}

		if(courseSectionList.length > 0) {
			return Promise.resolve(courseSectionList);
		}else{
			return Promise.reject(new InsightError("Invalid dataset, contains no course sections"));
		}
	}

	private parseCourseSection(sectionObj: any): any {
		return {
			dept: sectionObj["Subject"],
			id: sectionObj["Course"],
			instructor: sectionObj["Professor"],
			title: sectionObj["Title"],
			uuid: sectionObj["id"].toString(),

			avg: sectionObj["Avg"],
			pass: sectionObj["Pass"],
			fail: sectionObj["Fail"],
			audit: sectionObj["Audit"],
			year: sectionObj["Section"] === "overall" ? 1900 : parseInt(sectionObj["Year"], 10),
		};
	}

	/**
	 * Removes the dataset with this id.
	 * If successful, the promise resolves with the id of the removed dataset.
	 * If no dataset with this id exists, the promise rejects with a NotFoundError.
	 * Otherwise, the promise rejects with an InsightError.
	 * @param id id of the dataset to remove. REQUIRES: must be a valid id.
	 */
	public removeDataset(id: string): Promise<string> {
		const datasetToRemove = this.findDatasetWithId(id);

		if (!datasetToRemove) {
			return Promise.reject(new NotFoundError("Dataset \"" + id + "\" does not exist"));
		}

		try {
			const filePath = DatasetManager.getFilePath(datasetToRemove);
			fs.unlinkSync(filePath);

			this.datasets = this.datasets.filter((dataset: InsightDataset) => dataset.id !== id);

			return Promise.resolve(id);
		} catch (e) {
			return Promise.reject(new InsightError("Error removing the dataset: " + e));
		}
	}

	/**
	 * Checks if a dataset with this id currently exists.
	 * @param id dataset id to search for.
	 */
	public datasetExists(id: string): boolean {
		return !!this.findDatasetWithId(id);
	}

	/**
	 * Reads the JSON contents of this dataset off the disk.
	 * If no dataset with this id exists, throws an InsightError.
	 * Otherwise, returns the contents as a JavaScript array (assuming the dataset file was not changed)
	 * @param id id of the dataset to fetch
	 */
	public getDatasetContents(id: string): any {
		const dataset = this.findDatasetWithId(id);

		if (dataset) {
			const filePath = DatasetManager.getFilePath(dataset);
			const contents = fs.readFileSync(filePath, "utf-8");

			return JSON.parse(contents);
		} else {
			throw new InsightError("The dataset \"" + id + "\" does not exist");
		}
	}

	/**
	 * Returns the InsightDataset with the given id, or undefined if none was found.
	 */
	private findDatasetWithId(id: string): InsightDataset | undefined {
		return this.datasets.find((elem) => elem.id === id);
	}

	/**
	 * Returns the ids of all currently added datasets.
	 */
	private idsOfCurrentDatasets(): string[] {
		return this.datasets.map((dataset) => dataset.id);
	}

	/**
	 * Writes the given dataset and its contents to a file in {@link DATA_DIR}.
	 * @param dataset Information about the dataset - used to make the file name. Its kind should match the kind of the contents.
	 * @param contents Contents of the dataset.
	 */
	private writeDatasetContents(dataset: InsightDataset, contents: CourseSection[] | RoomsSection[]): void {
		if(!fs.existsSync(DATA_DIR)){
			fs.mkdirSync(DATA_DIR);
		}

		const filePath = DatasetManager.getFilePath(dataset);
		fs.writeFileSync(filePath, JSON.stringify(contents), "utf-8");
	}

	/**
	 * Maps this dataset to the file path in {@link DATA_DIR} where it will be saved.
	 * Resulting file path: ./data/<id>_<kind>_<numRows> (no extension)
	 * Example: "./data/coursesDataset_courses_200"
	 * @param dataset REQUIRES: should represent a valid dataset.
	 */
	private static getFilePath(dataset: InsightDataset): string {
		return DATA_DIR + dataset.id + "_" + dataset.kind + "_" + dataset.numRows;
	}

	/**
	 * Checks if a file name is formatted like a dataset file.
	 * @param fileName file name to validate
	 */
	private static isDatasetFile(fileName: string): boolean {
		return /^[^(\s|_)]+_(courses|rooms)_(\d)+$/.test(fileName);
	}

	/**
	 * Gets the dataset information from a file name.
	 * File name encoding: <id>_<kind>_<numRows> (no extension)
	 * @param fileName file name. REQUIRES: must be validated by {@link isDatasetFile}
	 */
	private static parseFileName(fileName: string): InsightDataset {
		const datasetInfo = fileName.split("_");
		const id: string = datasetInfo[0];
		const kind: InsightDatasetKind = datasetInfo[1] as InsightDatasetKind;
		const numRows = Number.parseInt(datasetInfo[2], 10);

		return { id, kind, numRows };
	}
}
