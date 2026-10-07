"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppThrottlerStorageModule = void 0;
const common_1 = require("@nestjs/common");
const abuse_guard_service_1 = require("./abuse-guard.service");
const device_auth_limiter_service_1 = require("./device-auth-limiter.service");
const redis_throttler_storage_service_1 = require("./redis-throttler-storage.service");
let AppThrottlerStorageModule = class AppThrottlerStorageModule {
};
exports.AppThrottlerStorageModule = AppThrottlerStorageModule;
exports.AppThrottlerStorageModule = AppThrottlerStorageModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [
            redis_throttler_storage_service_1.RedisThrottlerStorageService,
            device_auth_limiter_service_1.DeviceAuthLimiterService,
            abuse_guard_service_1.AbuseGuardService,
        ],
        exports: [
            redis_throttler_storage_service_1.RedisThrottlerStorageService,
            device_auth_limiter_service_1.DeviceAuthLimiterService,
            abuse_guard_service_1.AbuseGuardService,
        ],
    })
], AppThrottlerStorageModule);
//# sourceMappingURL=throttler.module.js.map