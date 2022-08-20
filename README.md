# Container Manager
Creates and manages Development and Deployment Containers.
Development Containers include a endpoint with a unyt workbench interface (file access, terminal, ...).

## Start
```shell
node main.js
```
## Create a new Workbench (Development) Container
```datex
container = @+unyt.container_manager :: createWorkbenchContainer();
container.start()
```