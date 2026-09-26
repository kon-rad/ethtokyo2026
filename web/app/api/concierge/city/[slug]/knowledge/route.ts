import { knowledgeHandlers } from "@/lib/concierge/routes";

const h = knowledgeHandlers("city");

export const GET = h.GET;
export const PUT = h.PUT;
export const POST = h.POST;
export const DELETE = h.DELETE;
