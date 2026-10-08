"""Process-tree accounting and Windows suspension for Pigeon's private worker.

Runs outside the model process so resource samples continue while it is suspended.
Only the supplied worker and its descendants are controlled; PID reuse is checked
by psutil's Process objects. No machine-wide free-memory admission checks.
"""
import json
import os
import sys
import threading
import psutil

root = psutil.Process(int(sys.argv[1]))
stop = threading.Event()
lock = threading.Lock()
suspended = {}
known = {}
terminate = False
paused = False


def processes():
    return [root, *root.children(recursive=True)]


def control(value):
    global paused
    # POSIX process groups are controlled by Node. Windows has no SIGSTOP.
    if os.name != 'nt':
        return
    paused = value
    if value:
        for process in processes():
            if process.pid not in suspended:
                process.suspend()
                suspended[process.pid] = process
    else:
        for process in list(suspended.values()):
            try:
                process.resume()
            except psutil.NoSuchProcess:
                pass
        suspended.clear()


def commands():
    global terminate
    try:
        for line in sys.stdin:
            request = json.loads(line)
            with lock:
                control(bool(request.get('paused', False)))
                if request.get('close'):
                    terminate = bool(request.get('terminate'))
                    stop.set()
                    return
    finally:
        stop.set()


threading.Thread(target=commands, daemon=True).start()
try:
    while not stop.is_set():
        with lock:
            ticks = 0
            rss = 0
            current = processes()
            known.clear()
            for process in current:
                try:
                    known[process.pid] = process
                    times = process.cpu_times()
                    ticks += (times.user + times.system + getattr(times, 'children_user', 0) + getattr(times, 'children_system', 0)) * 100
                    rss += process.memory_info().rss
                except psutil.NoSuchProcess:
                    continue
            if paused:
                control(True)
        print(json.dumps({'ticks': ticks, 'rss': rss}), flush=True)
        stop.wait(0.1)
except psutil.NoSuchProcess:
    pass
finally:
    with lock:
        if terminate:
            # Descendants first, including previously observed children if the
            # worker already exited. psutil checks identity before signalling.
            for process in reversed(list(known.values())):
                try:
                    process.kill()
                except psutil.NoSuchProcess:
                    pass
        else:
            control(False)
