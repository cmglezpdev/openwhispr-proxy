export interface ModelDescription {
  id: string;
  name?: string;
}

export interface ModelCatalog {
  models: ModelDescription[];
}
