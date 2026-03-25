import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { projectsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  CreateProjectBody,
  UpdateProjectBody,
  GetProjectParams,
  UpdateProjectParams,
  DeleteProjectParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/projects", async (_req, res) => {
  const projects = await db.select().from(projectsTable).orderBy(projectsTable.updatedAt);
  res.json(projects);
});

router.post("/projects", async (req, res) => {
  const body = CreateProjectBody.parse(req.body);
  const [project] = await db
    .insert(projectsTable)
    .values({
      name: body.name,
      objData: body.objData ?? null,
      dimensions: body.dimensions ?? null,
      unit: body.unit ?? "mm",
      scale: body.scale ?? 1,
    })
    .returning();
  res.status(201).json(project);
});

router.get("/projects/:id", async (req, res) => {
  const { id } = GetProjectParams.parse({ id: req.params.id });
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(project);
});

router.put("/projects/:id", async (req, res) => {
  const { id } = UpdateProjectParams.parse({ id: req.params.id });
  const body = UpdateProjectBody.parse(req.body);
  const [project] = await db
    .update(projectsTable)
    .set({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.objData !== undefined ? { objData: body.objData } : {}),
      ...(body.dimensions !== undefined ? { dimensions: body.dimensions } : {}),
      ...(body.unit !== undefined ? { unit: body.unit } : {}),
      ...(body.scale !== undefined ? { scale: body.scale } : {}),
      updatedAt: new Date(),
    })
    .where(eq(projectsTable.id, id))
    .returning();
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(project);
});

router.delete("/projects/:id", async (req, res) => {
  const { id } = DeleteProjectParams.parse({ id: req.params.id });
  await db.delete(projectsTable).where(eq(projectsTable.id, id));
  res.status(204).send();
});

export default router;
