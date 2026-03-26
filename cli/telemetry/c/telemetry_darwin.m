//go:build darwin

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>
#import <ApplicationServices/ApplicationServices.h>
#import <stdlib.h>
#import "telemetry_darwin.h"

void GetFrontmostAppAndTitle(char** outApp, char** outTitle) {
    @autoreleasepool {
        *outApp = strdup("Unknown");
        *outTitle = strdup("");

        CFArrayRef windowList = CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements, kCGNullWindowID);
        if (windowList) {
            CFIndex count = CFArrayGetCount(windowList);
            for (CFIndex i = 0; i < count; i++) {
                CFDictionaryRef windowInfo = (CFDictionaryRef)CFArrayGetValueAtIndex(windowList, i);
                NSNumber *layer = (NSNumber *)CFDictionaryGetValue(windowInfo, kCGWindowLayer);
                if (layer && [layer integerValue] == 0) {
                    NSString *owner = (NSString *)CFDictionaryGetValue(windowInfo, kCGWindowOwnerName);
                    NSString *name = (NSString *)CFDictionaryGetValue(windowInfo, kCGWindowName);
                    
                    if (owner) {
                        free(*outApp);
                        *outApp = strdup([owner UTF8String]);
                    }
                    if (name) {
                        free(*outTitle);
                        *outTitle = strdup([name UTF8String]);
                    }
                    break;
                }
            }
            CFRelease(windowList);
        }
    }
}

const char* GetActiveApp() {
    char *app = NULL;
    char *title = NULL;
    GetFrontmostAppAndTitle(&app, &title);
    free(title); // We only want the app
    return app;
}

const char* GetActiveWindowTitle() {
    char *app = NULL;
    char *title = NULL;
    GetFrontmostAppAndTitle(&app, &title);
    free(app); // We only want the title
    return title;
}

int GetIdleTime() {
    CFTimeInterval timeSinceLastEvent = CGEventSourceSecondsSinceLastEventType(kCGEventSourceStateHIDSystemState, kCGAnyInputEventType);
    return (int)timeSinceLastEvent;
}
