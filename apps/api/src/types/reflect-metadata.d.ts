// Ambient declarations to expose the metadata functions added by `reflect-metadata`.
// This avoids TS errors like "Property 'defineMetadata' does not exist on type 'typeof Reflect'".

declare namespace Reflect {
  function defineMetadata(
    metadataKey: any,
    metadataValue: any,
    target: Object,
    targetKey?: string | symbol,
  ): void;
  function hasMetadata(
    metadataKey: any,
    target: Object,
    targetKey?: string | symbol,
  ): boolean;
  function getMetadata(
    metadataKey: any,
    target: Object,
    targetKey?: string | symbol,
  ): any;
  function getOwnMetadata(
    metadataKey: any,
    target: Object,
    targetKey?: string | symbol,
  ): any;
}

export {};
