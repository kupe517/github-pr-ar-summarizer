const DEFAULT_MODEL = "gpt-6-luna";

function resolveModel(model) {
  switch (model) {
    case "gpt-5.6-sol":
      return "gpt-6-astra";
    case "gpt-5.6-terra":
      return "gpt-6.1-sol";
    case "gpt-5.6-luna":
      return DEFAULT_MODEL;
    default:
      return model || DEFAULT_MODEL;
  }
}
