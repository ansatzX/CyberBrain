# cyberbrain-pi

Pi host adapter for the Cyberbrain personal agent configuration repository.

## Development

```bash
npm --prefix pi install --legacy-peer-deps
npx --prefix pi tsx --test pi/test/*.test.ts
for file in pi/extensions/*.ts pi/lib/*.ts pi/lib/third-party/*.ts; do
  npx --prefix pi tsx --input-type=module -e "import '${file}'"
done
```

## Local install

```bash
bash tools/manage-pi.sh install
bash tools/manage-pi.sh doctor
```

The package does not manage credentials, sessions, goals, model preferences, themes, or thinking settings.
