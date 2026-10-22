"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Backward compatibility bridge: forward all legacy /api/sessions traffic directly to visit router
const visit_routes_1 = __importDefault(require("./visit.routes"));
exports.default = visit_routes_1.default;
