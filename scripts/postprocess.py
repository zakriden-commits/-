#!/usr/bin/env python3
"""Конвертация model/fighter_relief.glb -> OBJ+MTL+текстуры (trimesh)."""
import os
import sys

import trimesh

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GLB = os.path.join(ROOT, "model", "fighter_relief.glb")
OBJ = os.path.join(ROOT, "model", "fighter_relief.obj")


def main() -> int:
    if not os.path.exists(GLB):
        print("glb not found", file=sys.stderr)
        return 1
    scene = trimesh.load(GLB, force="scene")
    meshes = [g for g in scene.geometry.values() if isinstance(g, trimesh.Trimesh)]
    print("geometries:", len(meshes))
    scene.export(OBJ)
    for n in sorted(os.listdir(os.path.dirname(OBJ))):
        print(" ", n, os.path.getsize(os.path.join(os.path.dirname(OBJ), n)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
