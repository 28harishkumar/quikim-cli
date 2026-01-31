/**
 * Quikim - Duplicate Detector Tests
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * 
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  findDuplicateArtifact,
  findDuplicateTask,
  normalizeTaskDescription,
  hasContentChanged,
  findDuplicateArtifacts,
  findDuplicateTasks,
} from "./duplicate-detector.js";
import { ServerArtifact } from "../types/artifacts.js";
import { Task } from "./tasks-converter.js";

describe("normalizeTaskDescription", () => {
  it("should normalize task description by stripping HTML and collapsing whitespace", () => {
    const description = "<p>Task   Description</p>";
    const result = normalizeTaskDescription(description);
    assert.strictEqual(result, "task description");
  });

  it("should convert to lowercase", () => {
    const description = "Task DESCRIPTION Test";
    const result = normalizeTaskDescription(description);
    assert.strictEqual(result, "task description test");
  });

  it("should handle empty and null input", () => {
    assert.strictEqual(normalizeTaskDescription(""), "");
    assert.strictEqual(normalizeTaskDescription(null as unknown as string), "");
  });

  it("should handle HTML entities", () => {
    const description = "&lt;Task&gt; &amp; Description";
    const result = normalizeTaskDescription(description);
    assert.ok(result.includes("task"));
    assert.ok(result.includes("description"));
  });
});

describe("findDuplicateArtifact", () => {
  const createServerArtifact = (
    id: string,
    specName: string,
    artifactType: "requirement" | "hld" | "lld",
    artifactName: string,
    content: string,
    version: number = 1
  ): ServerArtifact => ({
    artifactId: id,
    specName,
    artifactType,
    artifactName,
    content,
    version,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it("should find duplicate artifact with matching metadata and content", () => {
    const serverArtifacts: ServerArtifact[] = [
      createServerArtifact("1", "auth", "requirement", "login", "User login requirement"),
      createServerArtifact("2", "auth", "requirement", "logout", "User logout requirement"),
    ];

    const result = findDuplicateArtifact(
      "auth",
      "requirement",
      "login",
      "User login requirement",
      serverArtifacts
    );

    assert.ok(result);
    assert.strictEqual(result.artifactId, "1");
  });

  it("should return null when no metadata match exists", () => {
    const serverArtifacts: ServerArtifact[] = [
      createServerArtifact("1", "auth", "requirement", "login", "User login requirement"),
    ];

    const result = findDuplicateArtifact(
      "auth",
      "requirement",
      "signup",
      "User signup requirement",
      serverArtifacts
    );

    assert.strictEqual(result, null);
  });

  it("should return artifact when metadata matches but content differs", () => {
    const serverArtifacts: ServerArtifact[] = [
      createServerArtifact("1", "auth", "requirement", "login", "Old content"),
    ];

    const result = findDuplicateArtifact(
      "auth",
      "requirement",
      "login",
      "New content",
      serverArtifacts
    );

    assert.ok(result);
    assert.strictEqual(result.artifactId, "1");
  });

  it("should match content ignoring HTML formatting differences", () => {
    const serverArtifacts: ServerArtifact[] = [
      createServerArtifact("1", "auth", "requirement", "login", "<p>User   login</p>"),
    ];

    const result = findDuplicateArtifact(
      "auth",
      "requirement",
      "login",
      "User login",
      serverArtifacts
    );

    assert.ok(result);
    assert.strictEqual(result.artifactId, "1");
  });

  it("should match content ignoring case differences", () => {
    const serverArtifacts: ServerArtifact[] = [
      createServerArtifact("1", "auth", "requirement", "login", "USER LOGIN"),
    ];

    const result = findDuplicateArtifact(
      "auth",
      "requirement",
      "login",
      "user login",
      serverArtifacts
    );

    assert.ok(result);
    assert.strictEqual(result.artifactId, "1");
  });

  it("should return latest version when multiple versions exist", () => {
    const serverArtifacts: ServerArtifact[] = [
      createServerArtifact("1", "auth", "requirement", "login", "Version 1", 1),
      createServerArtifact("1", "auth", "requirement", "login", "Version 2", 2),
      createServerArtifact("1", "auth", "requirement", "login", "Version 3", 3),
    ];

    const result = findDuplicateArtifact(
      "auth",
      "requirement",
      "login",
      "New content",
      serverArtifacts
    );

    assert.ok(result);
    assert.strictEqual(result.version, 3);
  });

  it("should handle empty server artifacts list", () => {
    const result = findDuplicateArtifact(
      "auth",
      "requirement",
      "login",
      "Content",
      []
    );

    assert.strictEqual(result, null);
  });

  it("should handle empty parameters", () => {
    const serverArtifacts: ServerArtifact[] = [
      createServerArtifact("1", "auth", "requirement", "login", "Content"),
    ];

    const result = findDuplicateArtifact(
      "",
      "requirement",
      "login",
      "Content",
      serverArtifacts
    );

    assert.strictEqual(result, null);
  });
});

describe("findDuplicateTask", () => {
  const createTask = (id: string, description: string, status: "not_started" | "completed" = "not_started"): Task => ({
    id,
    description,
    status,
    order: 0,
  });

  it("should find duplicate task with matching normalized description", () => {
    const existingTasks: Task[] = [
      createTask("1", "Implement login feature"),
      createTask("2", "Implement logout feature"),
    ];

    const result = findDuplicateTask("Implement login feature", existingTasks);

    assert.ok(result);
    assert.strictEqual(result.id, "1");
  });

  it("should return null when no match exists", () => {
    const existingTasks: Task[] = [
      createTask("1", "Implement login feature"),
    ];

    const result = findDuplicateTask("Implement signup feature", existingTasks);

    assert.strictEqual(result, null);
  });

  it("should match tasks ignoring HTML formatting", () => {
    const existingTasks: Task[] = [
      createTask("1", "<p>Implement   login</p>"),
    ];

    const result = findDuplicateTask("Implement login", existingTasks);

    assert.ok(result);
    assert.strictEqual(result.id, "1");
  });

  it("should match tasks ignoring case differences", () => {
    const existingTasks: Task[] = [
      createTask("1", "IMPLEMENT LOGIN"),
    ];

    const result = findDuplicateTask("implement login", existingTasks);

    assert.ok(result);
    assert.strictEqual(result.id, "1");
  });

  it("should match tasks ignoring whitespace differences", () => {
    const existingTasks: Task[] = [
      createTask("1", "Implement    login    feature"),
    ];

    const result = findDuplicateTask("Implement login feature", existingTasks);

    assert.ok(result);
    assert.strictEqual(result.id, "1");
  });

  it("should handle empty task list", () => {
    const result = findDuplicateTask("Implement login", []);

    assert.strictEqual(result, null);
  });

  it("should handle empty description", () => {
    const existingTasks: Task[] = [
      createTask("1", "Implement login"),
    ];

    const result = findDuplicateTask("", existingTasks);

    assert.strictEqual(result, null);
  });

  it("should handle null description", () => {
    const existingTasks: Task[] = [
      createTask("1", "Implement login"),
    ];

    const result = findDuplicateTask(null as unknown as string, existingTasks);

    assert.strictEqual(result, null);
  });
});

describe("hasContentChanged", () => {
  it("should return false for identical content", () => {
    const result = hasContentChanged("Same content", "Same content");
    assert.strictEqual(result, false);
  });

  it("should return false for content with different HTML formatting", () => {
    const result = hasContentChanged("<p>Content</p>", "Content");
    assert.strictEqual(result, false);
  });

  it("should return false for content with different whitespace", () => {
    const result = hasContentChanged("Content   here", "Content here");
    assert.strictEqual(result, false);
  });

  it("should return false for content with different case", () => {
    const result = hasContentChanged("CONTENT", "content");
    assert.strictEqual(result, false);
  });

  it("should return true for different content", () => {
    const result = hasContentChanged("Content A", "Content B");
    assert.strictEqual(result, true);
  });

  it("should handle empty strings", () => {
    const result = hasContentChanged("", "");
    assert.strictEqual(result, false);
  });
});

describe("findDuplicateArtifacts", () => {
  const createServerArtifact = (
    id: string,
    specName: string,
    artifactType: "requirement" | "hld" | "lld",
    artifactName: string,
    content: string
  ): ServerArtifact => ({
    artifactId: id,
    specName,
    artifactType,
    artifactName,
    content,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it("should find multiple duplicate artifacts", () => {
    const localArtifacts = [
      { specName: "auth", artifactType: "requirement" as const, artifactName: "login", content: "Login content" },
      { specName: "auth", artifactType: "requirement" as const, artifactName: "logout", content: "Logout content" },
      { specName: "auth", artifactType: "requirement" as const, artifactName: "signup", content: "Signup content" },
    ];

    const serverArtifacts: ServerArtifact[] = [
      createServerArtifact("1", "auth", "requirement", "login", "Login content"),
      createServerArtifact("2", "auth", "requirement", "logout", "Logout content"),
    ];

    const result = findDuplicateArtifacts(localArtifacts, serverArtifacts);

    assert.strictEqual(result.size, 2);
    assert.ok(result.has(0));
    assert.ok(result.has(1));
    assert.ok(!result.has(2));
  });

  it("should return empty map when no duplicates exist", () => {
    const localArtifacts = [
      { specName: "auth", artifactType: "requirement" as const, artifactName: "signup", content: "Signup content" },
    ];

    const serverArtifacts: ServerArtifact[] = [
      createServerArtifact("1", "auth", "requirement", "login", "Login content"),
    ];

    const result = findDuplicateArtifacts(localArtifacts, serverArtifacts);

    assert.strictEqual(result.size, 0);
  });

  it("should handle empty local artifacts", () => {
    const serverArtifacts: ServerArtifact[] = [
      createServerArtifact("1", "auth", "requirement", "login", "Login content"),
    ];

    const result = findDuplicateArtifacts([], serverArtifacts);

    assert.strictEqual(result.size, 0);
  });

  it("should handle empty server artifacts", () => {
    const localArtifacts = [
      { specName: "auth", artifactType: "requirement" as const, artifactName: "login", content: "Login content" },
    ];

    const result = findDuplicateArtifacts(localArtifacts, []);

    assert.strictEqual(result.size, 0);
  });
});

describe("findDuplicateTasks", () => {
  const createTask = (id: string, description: string): Task => ({
    id,
    description,
    status: "not_started",
    order: 0,
  });

  it("should find multiple duplicate tasks", () => {
    const taskDescriptions = [
      "Implement login",
      "Implement logout",
      "Implement signup",
    ];

    const existingTasks: Task[] = [
      createTask("1", "Implement login"),
      createTask("2", "Implement logout"),
    ];

    const result = findDuplicateTasks(taskDescriptions, existingTasks);

    assert.strictEqual(result.size, 2);
    assert.ok(result.has(0));
    assert.ok(result.has(1));
    assert.ok(!result.has(2));
  });

  it("should return empty map when no duplicates exist", () => {
    const taskDescriptions = ["Implement signup"];

    const existingTasks: Task[] = [
      createTask("1", "Implement login"),
    ];

    const result = findDuplicateTasks(taskDescriptions, existingTasks);

    assert.strictEqual(result.size, 0);
  });

  it("should handle empty task descriptions", () => {
    const existingTasks: Task[] = [
      createTask("1", "Implement login"),
    ];

    const result = findDuplicateTasks([], existingTasks);

    assert.strictEqual(result.size, 0);
  });

  it("should handle empty existing tasks", () => {
    const taskDescriptions = ["Implement login"];

    const result = findDuplicateTasks(taskDescriptions, []);

    assert.strictEqual(result.size, 0);
  });

  it("should match tasks ignoring formatting differences", () => {
    const taskDescriptions = [
      "<p>Implement   LOGIN</p>",
    ];

    const existingTasks: Task[] = [
      createTask("1", "implement login"),
    ];

    const result = findDuplicateTasks(taskDescriptions, existingTasks);

    assert.strictEqual(result.size, 1);
    assert.ok(result.has(0));
  });
});
