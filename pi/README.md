# cyberbrain-pi

Pi host adapter for the Cyberbrain personal agent configuration repository.

## Development

```bash
node --test pi/test/*.test.ts
for file in pi/extensions/*.ts pi/lib/*.ts pi/lib/third-party/*.ts; do
  node --input-type=module -e "import '${file}'"
done
```

TypeScript runs via Node's built-in type stripping (Node 22.6+); there are no npm dependencies to install.

## Local install

```bash
bash tools/manage-pi.sh install
bash tools/manage-pi.sh doctor
```

The package does not manage credentials, sessions, goals, model preferences, themes, or thinking settings.
