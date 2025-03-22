function generateProductId() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const digits = "0123456789";
    let id = "";
    for (let i = 0; i < 2; i++) id += chars[Math.floor(Math.random() * chars.length)];
    for (let i = 0; i < 5; i++) id += digits[Math.floor(Math.random() * digits.length)];
    return id;
}
export default generateProductId;
