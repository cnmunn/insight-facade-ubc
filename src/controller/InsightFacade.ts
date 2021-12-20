import {IInsightFacade, InsightDataset, InsightDatasetKind, InsightError, ResultTooLargeError} from "./IInsightFacade";
import {PrimitiveObject} from "./ICourseSection";
import {constructQuery} from "./query/ConstructQuery";
import QueryValidator from "./query/QueryValidator";
import DatasetManager from "./DatasetManager";
import {QueryEvaluator} from "./query/QueryEvaluator";
import {ColumnValidator} from "./query/ColumnValidator";

require("fs-extra");

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */

export default class InsightFacade implements IInsightFacade {
	public datasetManager: DatasetManager;

	constructor() {
		// console.trace("InsightFacadeImpl::init()");
		this.datasetManager = new DatasetManager();
	}

	public addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {

		if (!validDatasetId(id)) {
			return Promise.reject(new InsightError("Dataset id contains underscore, is blank, or is all whitespace"));
		} else if (this.datasetManager.datasetExists(id)) {
			return Promise.reject(new InsightError("Dataset id already exists"));
		}

		switch (kind) {
			case InsightDatasetKind.Rooms:
				return this.datasetManager.addRoomsDataset(id, content);
			case InsightDatasetKind.Courses:
				return this.datasetManager.addCoursesDataset(id, content);
		}
	}

	public removeDataset(id: string): Promise<string> {
		if (!validDatasetId(id)) {
			return Promise.reject(new InsightError("Dataset id contains underscore, is blank, or is all whitespace"));
		}
		// else if(!this.datasetManager.datasetExists(id)) {
		// 	return Promise.reject(new NotFoundError("Invalid Dataset id"));
		// }

		// at this point, we should know the directory exists
		return this.datasetManager.removeDataset(id);
	}

	public listDatasets(): Promise<InsightDataset[]> {
		return Promise.resolve(this.datasetManager.datasets);
	}

	public performQuery(query: any): Promise<any[]> {
		const columnValidator: ColumnValidator = new ColumnValidator(this.datasetManager);
		const queryValidator: QueryValidator = new QueryValidator(query, columnValidator);

		if (!queryValidator.checkValidQuery()) {
			return Promise.reject(new InsightError("Invalid query"));
		}

		const processedQuery = constructQuery(query, columnValidator);

		const datasetId = processedQuery.dataset;

		try {
			const sections: PrimitiveObject[] =  this.datasetManager.getDatasetContents(datasetId);

			const queryEvaluator: QueryEvaluator = new QueryEvaluator();
			const result = queryEvaluator.evaluateQuery(processedQuery, sections);

			if (result.length > 5000) {
				return Promise.reject(new ResultTooLargeError("Result too large"));
			}

			return Promise.resolve(result);
		} catch (err) {
			return Promise.reject(err);
		}
	}
}

// reads the contents of a file and places them into the sectionList array

/* checks if the ID is only whitespace or contains an underscore */
function validDatasetId(id: string): boolean{

	if (!(/^[^_]+$/.test(id))) {
		return false;
	}else if (!id.replace(/\s/g, "").length) {
		return false;
	}
	return true;
}
