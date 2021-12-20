import {PrimitiveObject} from "../ICourseSection";
import {Filter, Query} from "./Filters";
import {ResultSorter} from "./ResultSorter";
import {ResultGrouper} from "./ResultGrouper";

export class QueryEvaluator {
	private resultSorter: ResultSorter = new ResultSorter();
	private resultGrouper: ResultGrouper = new ResultGrouper();

	public evaluateQuery(query: Query, sections: PrimitiveObject[]): PrimitiveObject[] {
		const filteredResult: PrimitiveObject[] = this.applyFilter(query.filter, sections, query.dataset);

		let resultObjects: PrimitiveObject[] = filteredResult;

		if (query.groupColumns && query.transformations) {
			this.resultGrouper.applyGroups(query.groupColumns, filteredResult);

			resultObjects = this.resultGrouper.applyTransforms(query.transformations);
		}

		resultObjects = this.applySelect(resultObjects, query.columns);

		if (query.order) {
			resultObjects = this.resultSorter.applySort(query.order, resultObjects);
		}

		return resultObjects;
	}

	private applyFilter(filter: Filter | undefined, sections: PrimitiveObject[], datasetId: string): PrimitiveObject[] {
		const filtered: PrimitiveObject[] = [];

		for (const section of sections) {
			if (!filter || filter.evaluateFilter(section)) {
				const renamedColumns = this.changeColumns(section, datasetId);
				filtered.push(renamedColumns);
			}
		}

		return filtered;
	}

	private changeColumns(section: PrimitiveObject, datasetId: string): PrimitiveObject {
		const result: PrimitiveObject = {};

		for (const key of Object.keys(section)) {
			result[`${datasetId}_${key}`] = section[key];
		}

		return result;
	}

	private applySelect(objectArray: PrimitiveObject[], columns: string[]): PrimitiveObject[] {
		const result: PrimitiveObject[] = [];

		for (const obj of objectArray) {
			result.push(this.selectColumns(obj, columns));
		}

		return result;
	}

	private selectColumns(obj: PrimitiveObject, columns: string[]): PrimitiveObject {
		const result: PrimitiveObject = {};

		for (let column of columns) {
			result[column] = obj[column];
		}

		return result;
	}
}
