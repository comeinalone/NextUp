export const serviceClass = (id) => `service-${id}`
export const minutes = (value) => `${new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value)} min`
