import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url));
const site = resolve(dir, '../dist');
const destination = resolve(dir, '.render');
mkdirSync(destination, { recursive: true });

// Load the browser ES modules in an isolated context without loading the texture image.
const context = vm.createContext({ document: { createElementNS: () => ({
  addEventListener() {},
  removeEventListener() {}
}) } });
const loaded = new Map();

function moduleFor(name) {
  if (!loaded.has(name)) {
    loaded.set(name, new vm.SourceTextModule(readFileSync(resolve(site, name), 'utf8'), {
      context,
      identifier: name
    }));
  }
  return loaded.get(name);
}

async function load(name) {
  const entry = moduleFor(name);
  await entry.link(imp => moduleFor(imp.replace(/^\.\//, '')));
  await entry.evaluate();
  return entry.namespace;
}

const { builders } = await load('models.js');
const { mounts } = await load('collection.js');
const { Group, Vector3 } = moduleFor('three.js').namespace;
const v = new Vector3();

for (const [i, build] of builders.entries()) {
  const root = new Group();
  const parts = Array.from({ length: 4 }, () => new Group());
  root.add(...parts);
  build(parts);
  root.updateMatrixWorld(true);
  const pieces = [];

  for (const [j, part] of parts.entries()) {
    part.traverse(mesh => {
      if (!mesh.isMesh) return;
      const { geometry, material } = mesh;
      const position = geometry.attributes.position;
      const indices = geometry.index?.array ?? Array.from({ length: position.count }, (_, k) => k);
      const vertices = Array.from({ length: position.count }, (_, k) => {
        v.fromBufferAttribute(position, k).applyMatrix4(mesh.matrixWorld);
        return [v.x, -v.z, v.y].map(value => Math.round(value * 100000) / 100000);
      });
      pieces.push([material.color.toArray(), material.roughness, vertices, [...indices]]);
    });
    const name = mounts[i].key + (j < 3 ? '-s' + (j + 1) : '');
    writeFileSync(resolve(destination, name + '.json'), JSON.stringify(pieces));
  }
  if (i === 0) writeFileSync(resolve(destination, 'paper.json'), JSON.stringify(pieces.slice(0, 1)));
}
