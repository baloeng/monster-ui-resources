# Monster UI Resources

Create and Edit Global and Local Gateways for v4.3

Requires [Monster UI v.4.3](https://github.com/2600hz/monster-ui)

#### Installation instructions:
1. Copy the accounts app to your apps directory
2. Register the resource app
```bash
# sup crossbar_maintenance init_app PATH_TO_RESOURCE_DIRECTORY API_ROOT
# The Kazoo user should be able to read files from resource app directory
sup crossbar_maintenance init_app /var/www/html/monster-ui/apps/resources https://site.com:8443/v2/
```
3. Activate resource app in the Monster UI App Store ( `/#/apps/appstore` )

