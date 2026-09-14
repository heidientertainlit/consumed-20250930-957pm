/*
 * Public-header evidence, not a replacement SDK header.
 *
 * Source: OneSignal/OneSignal-iOS-SDK tag 5.6.1
 * Commit: 25977b771746b80db32da4e5f5cd8b1086707301
 *   iOS_SDK/OneSignalSDK/OneSignal_XCFramework/
 *   OneSignalFramework.xcframework/ios-arm64/
 *   OneSignalFramework.framework/Headers/OneSignalFramework.h
 * and
 *   iOS_SDK/OneSignalSDK/OneSignal_User/OneSignalUser.xcframework/
 *   ios-arm64/OneSignalUser.framework/Headers/OneSignalUser-Swift.h
 *
 * This snapshot records the declarations available from the released SDK
 * selected in ios/App/Podfile.lock. It is intentionally not included in an
 * application target. The SDK has token login and an onJwtExpired callback,
 * but it does not expose the newer invalidation/update declarations.
 */

@interface OneSignal : NSObject
+ (void)login:(NSString * _Nonnull)externalId;
+ (void)login:(NSString * _Nonnull)externalId
    withToken:(NSString * _Nullable)token
    NS_SWIFT_NAME(login(externalId:token:));
@end

@protocol OSUser
- (void)onJwtExpiredWithExpiredHandler:
    (void (^ _Nonnull)(NSString * _Nonnull externalId,
                       SWIFT_NOESCAPE void (^ _Nonnull completion)
                           (NSString * _Nonnull newJwtToken)))expiredHandler;
@end