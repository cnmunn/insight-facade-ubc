import {And, ApplyToken, EQ, Filter, GT, Is, LT, Not, Or, Order, Query, SortDirection, Transformation} from "./Filters";
import {ColumnValidator} from "./ColumnValidator";
import {InsightError} from "../IInsightFacade";

// TODO: could be able to validate query at the same time as we construct the query
//  		- if the query is not valid, throw an InsightError?
/**
 * Transforms the given query into our Query representation.
 * @param validQuery An object representing the query, which must be valid.
 */
export function constructQuery(validQuery: any, columnValidator: ColumnValidator): Query {
	const query: Query = {
		columns: columnValidator.columns,
		dataset: columnValidator.dataset,
	};

	if ("TRANSFORMATIONS" in validQuery) {
		query.groupColumns = columnValidator.groupKeys;
		query.transformations = constructTransformations(validQuery["TRANSFORMATIONS"]["APPLY"]);
	}

	if (Object.keys(validQuery["WHERE"]).length > 0) {
		query.filter = constructFilter(validQuery["WHERE"]);
	}

	if ("ORDER" in validQuery["OPTIONS"]) {
		query.order = constructOrder(validQuery["OPTIONS"]["ORDER"]);
	}

	return query;
}

function constructTransformations(validTransformations: any[]): Transformation[] {
	const result: Transformation[] = [];

	for (let applyRule of validTransformations) {
		const applyKey = Object.keys(applyRule)[0];
		const applyToken = Object.keys(applyRule[applyKey])[0];

		result.push({
			applyToken: applyToken as ApplyToken,
			columnName: applyKey,
			key: applyRule[applyKey][applyToken]
		});
	}

	return result;
}

function constructOrder(validOrder: any): Order {
	if (typeof validOrder === "string") {
		return {
			direction: SortDirection.Up,
			columns: [validOrder]
		};
	}

	// Must be object now
	return {
		direction: validOrder["dir"] as SortDirection,
		columns: validOrder["keys"]
	};
}

/**
 * Constructs a "tree" of filters out of the given object.
 * @param validFilter An object representing the filters, which must be valid.
 */
function constructFilter(validFilter: any): Filter {
	let filterKey = Object.keys(validFilter)[0];

	// get the property being tested inside the LT/GT/EQ/IS, and the value to compare against
	function getComparisonFieldAndValue() {
		const key: string = Object.keys(validFilter[filterKey])[0];
		const field: string = extractField(key);
		const value = validFilter[filterKey][key];
		return {field: field, value: value};
	}

	switch (filterKey) {
		case "LT": {
			const {field, value} = getComparisonFieldAndValue();
			return new LT(field, value);
		}
		case "GT": {
			const {field, value} = getComparisonFieldAndValue();
			return new GT(field, value);
		}
		case "EQ": {
			const {field, value} = getComparisonFieldAndValue();
			return new EQ(field, value);
		}
		case "AND": {
			return new And(getSubFilters(validFilter, filterKey));
		}
		case "OR": {
			return new Or(getSubFilters(validFilter, filterKey));
		}
		case "NOT": {
			const childFilter = validFilter[filterKey];
			return new Not(constructFilter(childFilter));
		}
		case "IS": {
			const {field, value} = getComparisonFieldAndValue();
			return new Is(field, value);
		}
		default:
			throw new InsightError("Could not construct a filter of type " + filterKey);
	}
}

function getSubFilters(validFilter: any, filterKey: string): Filter[] {
	const childFilters = validFilter[filterKey];			// childFilters is an any[]

	const filters: Filter[] = [];
	for (let childFilter of childFilters) {
		filters.push(constructFilter(childFilter));
	}

	return filters;
}

export function extractField(key: string): string {
	return key.split("_")[1];
}
