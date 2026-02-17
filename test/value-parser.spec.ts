import { describe, expect, it } from "vitest";
import { parseConfigValue } from "../src/value-parser";
import { ConfigState, ConfigType } from "../src/types";

const configState = (type: ConfigType, value: string | null | undefined): ConfigState => {
  return { id: "10", key: "test", type, value };
};

enum StringBasedEnum {
  One = "one",
  Two = "two",
  Three = "three",
};

enum FloatEnum {
  One = 1.5,
  Two = 2.6,
  Three = 3.7,
};

enum DefaultEnum {
  One,
  Two,
  Three,
};

describe("value parser", () => {
  describe("string", () => {
    it("returns the value as a string when the config type is string and generic type is string", () => {
      expect(parseConfigValue(configState("string", "hello"), "Default")).toMatchObject({
        parsedValue: "hello",
        reason: "found-match",
        requestedType: "string",
        usedDefault: false,
      });
      expect(parseConfigValue(configState("string", "  "), "Default")).toMatchObject({
        parsedValue: "  ",
        reason: "found-match",
        requestedType: "string",
        usedDefault: false,
      });
    });

    it("returns the default value when the config value is missing", () => {
      expect(parseConfigValue(configState("string", ""), "Default")).toMatchObject({
        parsedValue: "Default",
        reason: "value-missing",
        requestedType: "string",
        usedDefault: true,
      });
      expect(parseConfigValue(configState("string", undefined), "Default")).toMatchObject({
        parsedValue: "Default",
        reason: "value-missing",
        requestedType: "string",
        usedDefault: true,
      });
    });
  });

  describe("integer", () => {
    it("parses as an integer when the config type is 'integer' and generic type is number", () => {
      expect(parseConfigValue(configState("integer", "500"), 10)).toMatchObject({
        parsedValue: 500,
        reason: "found-match",
        requestedType: "number",
        usedDefault: false,
      });
      expect(parseConfigValue(configState("integer", "-100"), 10)).toMatchObject({
        parsedValue: -100,
        reason: "found-match",
        requestedType: "number",
        usedDefault: false,
      });
      expect(parseConfigValue(configState("integer", "50.5"), 10)).toMatchObject({
        parsedValue: 50,
        reason: "found-match",
        requestedType: "number",
        usedDefault: false,
      });
    });

    it("uses the default when parsing an integer fails", () => {
      expect(parseConfigValue(configState("integer", ""), 10)).toMatchObject({
        parsedValue: 10,
        reason: "value-missing",
        requestedType: "number",
        usedDefault: true,
      });
      expect(parseConfigValue(configState("integer", null), 10)).toMatchObject({
        parsedValue: 10,
        reason: "value-missing",
        requestedType: "number",
        usedDefault: true,
      });
      expect(parseConfigValue(configState("integer", "abc"), 10)).toMatchObject({
        parsedValue: 10,
        reason: "invalid-number",
        requestedType: "number",
        usedDefault: true,
      });
    });

    it("returns a string when the generic type is string", () => {
      expect(parseConfigValue<string>(configState("integer", "50.5"), "10")).toMatchObject({
        parsedValue: "50.5",
        reason: "found-match",
        requestedType: "string",
        usedDefault: false,
      });
    });
  });

  describe("float", () => {
    it("parses as an integer when the config type is 'float' and generic type is number", () => {
      expect(parseConfigValue(configState("float", "50.34"), 10.2)).toMatchObject({
        parsedValue: 50.34,
        reason: "found-match",
        requestedType: "number",
        usedDefault: false,
      });
      expect(parseConfigValue(configState("float", "-100.67"), 10.2)).toMatchObject({
        parsedValue: -100.67,
        reason: "found-match",
        requestedType: "number",
        usedDefault: false,
      });
      expect(parseConfigValue(configState("float", ".5"), 10.2)).toMatchObject({
        parsedValue: 0.5,
        reason: "found-match",
        requestedType: "number",
        usedDefault: false,
      });
    });

    it("uses the default when parsing a float fails", () => {
      expect(parseConfigValue(configState("float", ""), 10.2)).toMatchObject({
        parsedValue: 10.2,
        reason: "value-missing",
        requestedType: "number",
        usedDefault: true,
      });
      expect(parseConfigValue(configState("float", undefined), 10.2)).toMatchObject({
        parsedValue: 10.2,
        reason: "value-missing",
        requestedType: "number",
        usedDefault: true,
      });
      expect(parseConfigValue(configState("float", "abc"), 10.2)).toMatchObject({
        parsedValue: 10.2,
        reason: "invalid-number",
        requestedType: "number",
        usedDefault: true,
      });
    });

    it("returns a string when the generic type is string", () => {
      expect(parseConfigValue<string>(configState("float", "50.5"), "10")).toMatchObject({
        parsedValue: "50.5",
        reason: "found-match",
        requestedType: "string",
        usedDefault: false,
      });
    });
  });

  describe("boolean", () => {
    it("returns a boolean when the config type is boolean and the generic type is boolean", () => {
      expect(parseConfigValue(configState("boolean", "true"), false)).toMatchObject({
        parsedValue: true,
        reason: "found-match",
        requestedType: "boolean",
        usedDefault: false,
      });
      expect(parseConfigValue(configState("boolean", "TRUE"), false)).toMatchObject({
        parsedValue: true,
        reason: "found-match",
        requestedType: "boolean",
        usedDefault: false,
      });
      expect(parseConfigValue(configState("boolean", "false"), true)).toMatchObject({
        parsedValue: false,
        reason: "found-match",
        requestedType: "boolean",
        usedDefault: false,
      });
      expect(parseConfigValue(configState("boolean", "FALSE"), true)).toMatchObject({
        parsedValue: false,
        reason: "found-match",
        requestedType: "boolean",
        usedDefault: false,
      });
    });

    it("returns the default value when the boolean cannot be parsed", () => {
      expect(parseConfigValue(configState("boolean", ""), true)).toMatchObject({
        parsedValue: true,
        reason: "value-missing",
        requestedType: "boolean",
        usedDefault: true,
      });
      expect(parseConfigValue(configState("boolean", "foo"), true)).toMatchObject({
        parsedValue: true,
        reason: "invalid-boolean",
        requestedType: "boolean",
        usedDefault: true,
      });
      expect(parseConfigValue(configState("boolean", "  false  "), true)).toMatchObject({
        parsedValue: true,
        reason: "invalid-boolean",
        requestedType: "boolean",
        usedDefault: true,
      });
    });
  });

  describe("enum", () => {
    it("returns the value as enum when the config value is enum and the generic type is string", () => {
      expect(parseConfigValue<StringBasedEnum>(configState("enum", "one"), StringBasedEnum.Two)).toMatchObject({
        parsedValue: StringBasedEnum.One,
        reason: "found-match",
        requestedType: "string",
        usedDefault: false,
      });
      expect(parseConfigValue(configState("enum", "two"), StringBasedEnum.One)).toMatchObject({
        parsedValue: StringBasedEnum.Two,
        reason: "found-match",
        requestedType: "string",
        usedDefault: false,
      });
    });

    it("returns the value as enum when the config value is enum and the generic type is number", () => {
      expect(parseConfigValue<DefaultEnum>(configState("enum", "0"), DefaultEnum.Two)).toMatchObject({
        parsedValue: DefaultEnum.One,
        reason: "found-match",
        requestedType: "number",
        usedDefault: false,
      });
      expect(parseConfigValue(configState("enum", "2"), DefaultEnum.One)).toMatchObject({
        parsedValue: DefaultEnum.Three,
        reason: "found-match",
        requestedType: "number",
        usedDefault: false,
      });
      expect(parseConfigValue<FloatEnum>(configState("enum", "1.5"), FloatEnum.Two)).toMatchObject({
        parsedValue: FloatEnum.One,
        reason: "found-match",
        requestedType: "number",
        usedDefault: false,
      });
      expect(parseConfigValue(configState("enum", "3.7"), FloatEnum.One)).toMatchObject({
        parsedValue: FloatEnum.Three,
        reason: "found-match",
        requestedType: "number",
        usedDefault: false,
      });
    });

    it("returns the value as string or number when the config is enum and the value is not in the enum list", () => {
      expect(parseConfigValue<StringBasedEnum>(configState("enum", "other"), StringBasedEnum.Two)).toMatchObject({
        parsedValue: "other",
        reason: "found-match",
        requestedType: "string",
        usedDefault: false,
      });
      expect(parseConfigValue<FloatEnum>(configState("enum", "10.54"), FloatEnum.One)).toMatchObject({
        parsedValue: 10.54,
        reason: "found-match",
        requestedType: "number",
        usedDefault: false,
      });
    });
  });
});
