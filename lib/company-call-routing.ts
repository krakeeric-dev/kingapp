export type CompanyCallRoute = {
  companyId: string;
  companyName: string;
  inboundNumber: string;
  department: string;
  defaultQueue: string;
};

export const companyCallRoutes: CompanyCallRoute[] = [];

function normalizePhone(phone?: string) {
  return (phone ?? "").replace(/\D/g, "");
}

export function routeCallByInboundNumber(toNumber?: string) {
  const normalizedTo = normalizePhone(toNumber);
  return (
    companyCallRoutes.find((route) => normalizePhone(route.inboundNumber) === normalizedTo) ??
    null
  );
}

export function getUnknownCompanyCallLabel() {
  return "Unknown Company Call";
}
