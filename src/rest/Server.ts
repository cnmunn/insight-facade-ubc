import express, {Application, Request, Response} from "express";
import * as http from "http";
import cors from "cors";
import InsightFacade from "../controller/InsightFacade";
import {InsightDataset, InsightDatasetKind, InsightError, NotFoundError} from "../controller/IInsightFacade";

export default class Server {
	public static readonly GET_ENDPOINT = "/datasets";
	public static readonly POST_ENDPOINT = "/query";
	public static readonly DELETE_ENDPOINT = "/dataset";
	public static readonly PUT_ENDPOINT = "/dataset";

	private static readonly idParam = "id";
	private static readonly kindParam = "kind";

	private readonly port: number;
	private express: Application;
	private server: http.Server | undefined;

	private insightFacade: InsightFacade;

	constructor(port: number) {
		console.info(`Server::<init>( ${port} )`);
		this.port = port;
		this.express = express();

		this.registerMiddleware();
		this.registerRoutes();

		// NOTE: you can serve static frontend files in from your express server
		// by uncommenting the line below. This makes files in ./frontend/public
		// accessible at http://localhost:<port>/
		this.express.use(express.static("./frontend/public"));

		this.insightFacade = new InsightFacade();
	}

	/**
	 * Starts the server. Returns a promise that resolves if success. Promises are used
	 * here because starting the server takes some time and we want to know when it
	 * is done (and if it worked).
	 *
	 * @returns {Promise<void>}
	 */
	public start(): Promise<void> {
		return new Promise((resolve, reject) => {
			console.info("Server::start() - start");
			if (this.server !== undefined) {
				console.error("Server::start() - server already listening");
				reject();
			} else {
				this.server = this.express.listen(this.port, () => {
					console.info(`Server::start() - server listening on port: ${this.port}`);
					resolve();
				}).on("error", (err: Error) => {
					// catches errors in server start
					console.error(`Server::start() - server ERROR: ${err.message}`);
					reject(err);
				});
			}
		});
	}

	/**
	 * Stops the server. Again returns a promise so we know when the connections have
	 * actually been fully closed and the port has been released.
	 *
	 * @returns {Promise<void>}
	 */
	public stop(): Promise<void> {
		console.info("Server::stop()");
		return new Promise((resolve, reject) => {
			if (this.server === undefined) {
				console.error("Server::stop() - ERROR: server not started");
				reject();
			} else {
				this.server.close(() => {
					console.info("Server::stop() - server closed");
					resolve();
				});
			}
		});
	}

	// Registers middleware to parse request before passing them to request handlers
	private registerMiddleware() {
		// JSON parser must be place before raw parser because of wildcard matching done by raw parser below
		this.express.use(express.json());
		this.express.use(express.raw({type: "application/*", limit: "10mb"}));

		// enable cors in request headers to allow cross-origin HTTP requests
		this.express.use(cors());
	}

	// Registers all request handlers to routes
	private registerRoutes() {
		// This is an example endpoint this you can invoke by accessing this URL in your browser:
		// http://localhost:4321/echo/hello
		this.express.get("/echo/:msg", Server.echo);

		// TODO: your other endpoints should go here
		this.express.get(Server.GET_ENDPOINT, this.getDatasets.bind(this));
		this.express.put(`${Server.PUT_ENDPOINT}/:${Server.idParam}/:${Server.kindParam}`, this.addDataset.bind(this));
		this.express.delete(`${Server.DELETE_ENDPOINT}/:${Server.idParam}`, this.deleteDataset.bind(this));
		this.express.post(Server.POST_ENDPOINT, this.postQuery.bind(this));
	}

	// The next two methods handle the echo service.
	// These are almost certainly not the best place to put these, but are here for your reference.
	// By updating the Server.echo function pointer above, these methods can be easily moved.
	private static echo(req: Request, res: Response) {
		try {
			console.log(`Server::echo(..) - params: ${JSON.stringify(req.params)}`);
			const response = Server.performEcho(req.params.msg);
			res.status(200).json({result: response});
		} catch (err) {
			res.status(400).json({error: err});
		}
	}

	private static performEcho(msg: string): string {
		if (typeof msg !== "undefined" && msg !== null) {
			return `${msg}...${msg}`;
		} else {
			return "Message not provided";
		}
	}

	public newInsightFacade(): void {
		this.insightFacade = new InsightFacade();
	}

	// TODO: check content type?
	private async addDataset(request: Request, response: Response): Promise<void> {
		const datasetId: string = request.params[Server.idParam];

		const reqKind = request.params[Server.kindParam];
		if (!(reqKind === InsightDatasetKind.Courses || reqKind === InsightDatasetKind.Rooms)) {
			this.setResponseError(response, 400, "Invalid dataset kind");
			return;
		}

		try {
			const zipContent: string = Buffer.from(request.body).toString("base64");

			const addedIds: string[] = await this.insightFacade.addDataset(datasetId, zipContent, reqKind);
			this.setResponseResult(response, addedIds);
		} catch (err) {
			this.setResponseError(response, 400, err);
		}
	}

	private async deleteDataset(request: Request, response: Response): Promise<void> {
		const idToDelete: string = request.params[Server.idParam];

		try {
			const deletedId: string = await this.insightFacade.removeDataset(idToDelete);

			this.setResponseResult(response, deletedId);
		} catch (err) {
			if (err instanceof NotFoundError) {
				this.setResponseError(response, 404, err);
			} else if (err instanceof InsightError) {
				this.setResponseError(response, 400, err);
			}
		}
	}

	private async getDatasets(request: Request, response: Response): Promise<void> {
		const datasets: InsightDataset[] = await this.insightFacade.listDatasets();
		this.setResponseResult(response, datasets);
	}

	private async postQuery(request: Request, response: Response): Promise<void> {
		try {
			const query = request.body;
			const queryResult: any[] = await this.insightFacade.performQuery(query);

			this.setResponseResult(response, queryResult);
		} catch (err) {
			this.setResponseError(response, 400, err);
		}
	}

	private setResponseError(response: Response, statusCode: number, err: unknown) {
		response.status(statusCode).json({
			error: String(err)
		});
	}

	private setResponseResult(response: Response, result: any) {
		const successCode = 200;

		response.status(successCode).json({
			result: result
		});
	}
}
