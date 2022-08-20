var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Datex } from "./unyt_core/datex_runtime.js";
import { template, property } from "./unyt_core/legacy_decorators.js";
let EndpointConfig = class EndpointConfig {
    version;
    endpoint;
    ['expose-database'];
};
__decorate([
    property,
    __metadata("design:type", Number)
], EndpointConfig.prototype, "version", void 0);
__decorate([
    property,
    __metadata("design:type", Datex.Addresses.Endpoint)
], EndpointConfig.prototype, "endpoint", void 0);
__decorate([
    property('expose-database'),
    __metadata("design:type", Boolean)
], EndpointConfig.prototype, 'expose-database', void 0);
EndpointConfig = __decorate([
    template('<unyt:endpoint-config>')
], EndpointConfig);
export { EndpointConfig };
