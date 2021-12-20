import {Order, SortDirection} from "./Filters";

export class ResultSorter {
	public applySort(order: Order, objectArray: any[]): any[] {
		if (order.direction === SortDirection.Up) {
			return objectArray.sort((a: any, b: any) => this.ascendingCompare(a, b, order.columns));
		} else {
			return objectArray.sort((a: any, b: any) => this.descendingCompare(a, b, order.columns));
		}
	}

	private ascendingCompare(a: any, b: any, sortKeys: string[]): number {
		for (let sortKey of sortKeys) {
			if (a[sortKey] > b[sortKey]) {
				return 1;
			} else if (a[sortKey] < b[sortKey]) {
				return -1;
			}
		}

		return 0;
	}

	private descendingCompare(a: any, b: any, sortKeys: string[]): number {
		for (let sortKey of sortKeys) {
			if (a[sortKey] > b[sortKey]) {
				return -1;
			} else if (a[sortKey] < b[sortKey]) {
				return 1;
			}
		}

		return 0;
	}
}
