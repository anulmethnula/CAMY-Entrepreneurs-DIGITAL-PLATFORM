export const initialProducts = [
  { id: 1, name: '12,000 BTU Inverter AC', category: 'Home Appliances', price: 160000, image: '/products/ac-12000.png', tag: 'Best seller', stock: 14, code: 'CY-12INV', rating: 4.9, warranty: '5 years', description: 'Fast, quiet cooling designed for comfortable Sri Lankan homes.', specs: ['Super Cool technology', 'Low-noise operation', 'Free installation up to 3m', '5-year compressor warranty'] },
  { id: 2, name: '18,000 BTU Air Conditioner', category: 'Home Appliances', price: 175000, image: '/products/ac-18000.png', tag: 'Popular', stock: 8, code: 'CY-18AC', rating: 4.8, warranty: '5 years', description: 'High-volume cooling with an elegant, efficient design.', specs: ['Maximum air volume', '3 free services', 'Free installation up to 3m', 'Low-noise operation'] },
  { id: 3, name: '18cm Non-stick Hopper Pan', category: 'Cookware', price: 1950, image: '/products/hopper-pan.png', tag: 'Fast moving', stock: 32, code: 'HPL001', rating: 4.9, warranty: '1 year', description: 'A durable everyday hopper pan made with pride in Sri Lanka.', specs: ['Made in Sri Lanka', 'Stick-proof coating', 'Stainless-steel lid', 'Easy-clean surface'] },
  { id: 4, name: '22cm Non-stick Fry Pan', category: 'Cookware', price: 1750, image: '/products/frypan-22.png', tag: '', stock: 27, code: 'FP022', rating: 4.7, warranty: '1 year', description: 'A practical non-stick pan for reliable everyday cooking.', specs: ['Durable non-stick surface', 'Cool-touch handle', 'Everyday cooking size', 'Easy to clean'] },
  { id: 5, name: '24,000 BTU Air Conditioner', category: 'Home Appliances', price: 200000, image: '/products/ac-24000.png', tag: 'Premium', stock: 5, code: 'CY-24AC', rating: 4.8, warranty: '5 years', description: 'Powerful cooling for large rooms and commercial spaces.', specs: ['Powerful room cooling', 'Low-noise operation', '3 free services', '1-year component warranty'] },
  { id: 6, name: '24cm Non-stick Casserole', category: 'Cookware', price: 4500, image: '/products/casserole.png', tag: '', stock: 18, code: 'CRL024', rating: 4.6, warranty: '1 year', description: 'Family-size casserole with a fitted glass lid.', specs: ['Glass lid included', 'Even heat distribution', 'Easy-clean interior', 'Comfort handles'] },
  { id: 7, name: '24cm Non-stick Fry Pan', category: 'Cookware', price: 2650, image: '/products/frypan-24.png', tag: 'New', stock: 21, code: 'FP024', rating: 4.8, warranty: '1 year', description: 'A larger non-stick pan for family meals and easy serving.', specs: ['Family-size surface', 'Non-stick finish', 'Ergonomic handle', 'Balanced construction'] },
  { id: 8, name: '4-Piece Non-stick Set', category: 'Cookware', price: 5250, image: '/products/cookware-set.png', tag: 'Value pack', stock: 25, code: 'CWS401', rating: 5.0, warranty: '1 year', description: 'A coordinated cookware starter set offering strong customer value.', specs: ['18cm, 20cm & 22cm pans', 'Nylon spoon included', 'Made in Sri Lanka', 'Gift-ready set'] },
  { id: 9, name: '43-inch Smart TV', category: 'Electronics', price: 37000, image: '/products/smart-tv.png', tag: 'Hot deal', stock: 11, code: 'CY43-QLED', rating: 4.7, warranty: '2 years', description: 'A slim smart television with the connections customers need.', specs: ['Android 14', 'Frameless slim design', '2 × HDMI and 2 × USB', '2-year warranty'] },
  { id: 10, name: 'Classic Cookware Set', category: 'Cookware', price: 3950, image: '/products/classic-set.png', tag: '', stock: 19, code: 'CWS-CLASSIC', rating: 4.7, warranty: '1 year', description: 'A simple, reliable cookware bundle for daily use.', specs: ['Everyday cookware set', 'Easy-clean finish', 'Comfort-grip handles', 'Durable construction'] },
]

export const initialOrders = [
  { id: 'CMY-2849', customer: 'N. Perera', phone: '077 234 8891', product: '12,000 BTU Inverter AC', qty: 1, amount: 160000, date: '2026-09-09', status: 'Dispatched', entrepreneur: 'Supun Kumara', address: '22, Lake Road, Kurunegala' },
  { id: 'CMY-2846', customer: 'A. Fernando', phone: '071 994 2210', product: '4-Piece Non-stick Set', qty: 1, amount: 5250, date: '2026-09-08', status: 'Delivered', entrepreneur: 'Supun Kumara', address: '18, Temple Lane, Kandy' },
  { id: 'CMY-2838', customer: 'S. Kumari', phone: '075 229 7721', product: '43-inch Smart TV', qty: 1, amount: 37000, date: '2026-09-06', status: 'Processing', entrepreneur: 'Supun Kumara', address: '90, Flower Road, Colombo 07' },
  { id: 'CMY-2827', customer: 'R. Jayasinghe', phone: '076 447 1882', product: '18cm Non-stick Hopper Pan', qty: 1, amount: 1950, date: '2026-09-04', status: 'Delivered', entrepreneur: 'Supun Kumara', address: '11, Main Street, Galle' },
  { id: 'CMY-2812', customer: 'I. Niroshan', phone: '070 110 8299', product: '24cm Non-stick Fry Pan', qty: 1, amount: 2650, date: '2026-09-01', status: 'Returned', entrepreneur: 'Supun Kumara', address: '7, Station Road, Gampaha' },
]

export const initialEntrepreneurs = [
  { id: 'CE-0138', name: 'Hasini Jayawardena', phone: '077 114 8892', nic: '199766510842', city: 'Kandy', sales: 524800, credit: 40000, used: 16200, stage: 'Credit eligible', joined: '2026-01-12', initials: 'HJ' },
  { id: 'CE-0152', name: 'Dilan Perera', phone: '071 882 9910', nic: '199324810055', city: 'Gampaha', sales: 488250, credit: 40000, used: 8700, stage: 'Credit eligible', joined: '2026-02-03', initials: 'DP' },
  { id: 'CE-0194', name: 'Supun Kumara', phone: '077 123 4567', nic: '199512345678', city: 'Kurunegala', sales: 378500, credit: 30000, used: 11350, stage: 'Credit eligible', joined: '2026-03-21', initials: 'SK' },
  { id: 'CE-0208', name: 'Fathima Razik', phone: '075 382 1001', nic: '199855610245', city: 'Colombo', sales: 426900, credit: 40000, used: 22800, stage: 'Credit eligible', joined: '2026-04-10', initials: 'FR' },
  { id: 'CE-0241', name: 'Nimali Silva', phone: '076 401 2938', nic: '200014810042', city: 'Galle', sales: 86900, credit: 0, used: 0, stage: 'Trial seller', joined: '2026-07-19', initials: 'NS' },
]

export const initialTiers = [
  { id: 1, sales: 100000, credit: 10000 },
  { id: 2, sales: 200000, credit: 20000 },
  { id: 3, sales: 300000, credit: 30000 },
  { id: 4, sales: 400000, credit: 40000 },
  { id: 5, sales: 1000000, credit: 100000 },
]

export const initialNotifications = [
  { id: 1, title: 'Order CMY-2849 is on its way', body: 'The customer order left the Colombo warehouse.', time: '18 min ago', type: 'delivery', read: false },
  { id: 2, title: 'You moved up to rank #4', body: 'Your sales grew by 18.2% this month.', time: '2 hours ago', type: 'growth', read: false },
  { id: 3, title: 'Settlement reminder', body: 'Rs. 8,700 is due by 18 September.', time: 'Yesterday', type: 'credit', read: false },
  { id: 4, title: 'The 2026 catalogue is live', body: 'Explore new cookware and home appliances.', time: '3 days ago', type: 'catalogue', read: true },
]
