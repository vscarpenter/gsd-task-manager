export function externalizeInlineAssets(outputDirectory: string): {
  executableScripts: number;
  styleBlocks: number;
};

export function isExecutableScript(attributes: string, body: string): boolean;
