import { makeFunctionReference } from "convex/server";

export const api = {
  teams: {
    list: makeFunctionReference("teams:list"),
    create: makeFunctionReference("teams:create"),
    update: makeFunctionReference("teams:update"),
    remove: makeFunctionReference("teams:remove"),
    setLocal: makeFunctionReference("teams:setLocal"),
  },
  settings: {
    get: makeFunctionReference("settings:get"),
    update: makeFunctionReference("settings:update"),
  },
};
