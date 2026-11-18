import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { criarServidor } from "./servidor";

const servidor = criarServidor();
await servidor.connect(new StdioServerTransport());
