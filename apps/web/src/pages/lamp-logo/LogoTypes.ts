export type LogoMask = {
  width: number;
  height: number;
  alpha: number[];
};

export type LogoConfig = {
  name: string;
  source: string;
  enabled: boolean;
  width: number;
  height: number;
  depth: number;
  position: number;
  mask: LogoMask | null;
};

export type LogoCopy = {
  logo: string;
  importLogo: string;
  logoHint: string;
  chooseFile: string;
  replaceLogo: string;
  removeLogo: string;
  useLogo: string;
  logoWidth: string;
  logoHeight: string;
  logoDepth: string;
  logoPosition: string;
  logoInvalid: string;
};
