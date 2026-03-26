#ifndef TELEMETRY_DARWIN_H
#define TELEMETRY_DARWIN_H

#ifdef __cplusplus
extern "C" {
#endif

const char* GetActiveApp(void);
int GetIdleTime(void);
const char* GetActiveWindowTitle(void);

#ifdef __cplusplus
}
#endif

#endif // TELEMETRY_DARWIN_H
