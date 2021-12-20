import {PrimitiveObject} from "../ICourseSection";
import {ApplyToken, Transformation} from "./Filters";
import Decimal from "decimal.js";

export class ResultGrouper {
	private readonly groups: Map<string, PrimitiveObject[]>;

	public constructor() {
		this.groups = new Map<string, PrimitiveObject[]>();
	}

	public applyGroups(groupColumns: string[], filteredSections: PrimitiveObject[]) {
		for (const section of filteredSections) {
			this.addToGroup(groupColumns, section);
		}
	}

	private addToGroup(groupColumns: string[], obj: PrimitiveObject) {
		const group: PrimitiveObject = this.getGroupUniqueValues(groupColumns, obj);
		const groupIdString: string = this.getMapKeyFromGroup(group);

		if (this.groups.has(groupIdString)) {
			this.groups.get(groupIdString)?.push(obj);
		} else {
			this.groups.set(groupIdString, [ obj ]);
		}
	}

	private getMapKeyFromGroup(group: PrimitiveObject): string {
		// TODO: has to preserve order
		// Order-preserving trick obtained from: https://stackoverflow.com/a/16168003
		return JSON.stringify(group, Object.keys(group).sort());
	}

	private getGroupFromMapKey(mapKey: string): PrimitiveObject {
		return JSON.parse(mapKey);
	}

	private getGroupUniqueValues(groupColumns: string[], obj: PrimitiveObject): PrimitiveObject {
		const group: PrimitiveObject = {};

		for (const column of groupColumns) {
			group[column] = obj[column];
		}

		return group;
	}

	public applyTransforms(transformations: Transformation[]): PrimitiveObject[] {
		const transformResults: PrimitiveObject[] = [];

		for (const [groupId, sections] of this.groups) {
			const group: PrimitiveObject = this.getGroupFromMapKey(groupId);

			this.addTransformResultsToGroup(group, transformations, sections);

			transformResults.push(group);
		}

		return transformResults;
	}

	private addTransformResultsToGroup(group: PrimitiveObject, transforms: Transformation[],
		sections: PrimitiveObject[]): void {

		for (const transform of transforms) {
			group[transform.columnName] = this.getTransformResult(transform, sections);
		}
	}

	private getTransformResult(transform: Transformation, sections: PrimitiveObject[]): number {
		switch (transform.applyToken) {
			case ApplyToken.Min:
				return this.getMin(transform.key, sections);
			case ApplyToken.Max:
				return this.getMax(transform.key, sections);
			case ApplyToken.Avg:
				return this.getAvg(transform.key, sections);
			case ApplyToken.Sum:
				return this.getSum(transform.key, sections);
			case ApplyToken.Count:
				return this.getCount(transform.key, sections);
		}
	}

	// REQUIRES: key is a mKey
	private getMin(key: string, sections: PrimitiveObject[]): number {
		let min: number = Number.POSITIVE_INFINITY;

		for (const section of sections) {
			const value: number = section[key] as number;

			if (value < min) {
				min = value;
			}
		}

		return min;
	}

	// REQUIRES: key is a mKey
	private getMax(key: string, sections: PrimitiveObject[]): number {
		let max: number = Number.NEGATIVE_INFINITY;

		for (const section of sections) {
			const value: number = section[key] as number;

			if (value > max) {
				max = value;
			}
		}

		return max;
	}

	// REQUIRES: key is a mKey
	private getAvg(key: string, sections: PrimitiveObject[]): number {
		let numRows: number = sections.length;
		if (numRows === 0) {
			return 0;
		}

		let total: Decimal = new Decimal(0);

		for (const section of sections) {
			const value = section[key];
			const valueDecimal = new Decimal(value);
			total = total.add(valueDecimal);
		}

		const avg = total.toNumber() / numRows;

		return Number(avg.toFixed(2));
	}

	// REQUIRES: key is a mKey
	private getSum(key: string, sections: PrimitiveObject[]): number {
		let sum: number = 0;

		for (const section of sections) {
			sum += section[key] as number;
		}

		return Number(sum.toFixed(2));
	}

	private getCount(key: string, sections: PrimitiveObject[]): number {
		const uniqueValues: Set<string | number> = new Set<string | number>();

		for (const section of sections) {
			uniqueValues.add(section[key]);
		}

		return uniqueValues.size;
	}
}
