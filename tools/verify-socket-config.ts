type PackageJson = {
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
};

type Bunfig = {
  readonly install?: {
    readonly security?: {
      readonly scanner?: string;
    };
  };
};

const expectedScanner = "@socketsecurity/bun-security-scanner";
const bunfig = Bun.TOML.parse(await Bun.file("bunfig.toml").text()) as Bunfig;
const packageJson = (await Bun.file("package.json").json()) as PackageJson;
const scanner = bunfig.install?.security?.scanner;
const dependencies = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
};

if (scanner !== expectedScanner) {
  console.error(`bunfig.toml must set [install.security] scanner = "${expectedScanner}".`);
  process.exit(1);
}

if (!dependencies[expectedScanner]) {
  console.error(`package.json must include ${expectedScanner}.`);
  process.exit(1);
}

export {};
