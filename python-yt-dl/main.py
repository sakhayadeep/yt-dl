from fastapi import FastAPI
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import threading

app = FastAPI()
server = None
server_ready = threading.Event()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/hello")
def hello():
    return {"msg": "Hello from Python backend!"}

class User(BaseModel):
    name: str
    job: str | None = None
    salary: float
    tax: float | None = None

@app.post("/api/user")
async def create_user(user: User):
    return user



@app.post("/shutdown")
async def shutdown():
    """Request a graceful shutdown of the running server.

    This checks that the server object is available and avoids a race
    condition where the endpoint is called before the server is created.
    """
    print("Graceful shutdown initiated")
    global server
    # If the server hasn't been created yet, return a helpful response
    if not server_ready.is_set() or server is None:
        return {"status": "server not ready"}

    # Setting should_exit tells uvicorn.Server to stop its event loop
    server.should_exit = True
    return {"status": "stopping"}


def run_server():
    global server
    # IMPORTANT: remove `workers` so uvicorn doesn't spawn separate worker
    # processes. Programmatic control of Server only works reliably when in
    # the same process (same Python interpreter). Using `workers` uses
    # multiprocessing which breaks the `server` reference used by /shutdown.
    config = uvicorn.Config(app, host="0.0.0.0", port=5000)
    server = uvicorn.Server(config)

    # notify other threads / endpoints that the server instance is ready
    server_ready.set()

    # This will run until server.should_exit is set
    server.run()


if __name__ == "__main__":
    # run uvicorn.Server in a separate thread so this process can still
    # interact with it (for example, the shutdown endpoint will run in
    # the server's event loop thread and set server.should_exit).
    server_thread = threading.Thread(target=run_server)
    server_thread.start()

    # Wait until the server thread ends (eg. after /shutdown was called)
    server_thread.join()
    print("Server fully stopped")