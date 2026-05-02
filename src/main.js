/**
 * Функция для расчета выручки от одной позиции в чеке с учётом скидки.
 * @param purchase – запись о покупке из items чека
 * @param _product – карточка товара (не используется, зарезервирован для будущих доработок)
 * @returns {number} выручка за конкретную позицию
 */
function calculateSimpleRevenue(purchase, _product) {
  const { discount, sale_price, quantity } = purchase;
  const discountFactor = 1 - discount / 100;
  return sale_price * quantity * discountFactor;
}

/**
 * Функция для расчета бонуса продавца на основе его места в рейтинге по прибыли.
 * @param index – индекс продавца в отсортированном по убыванию прибыли массиве (0 – первый)
 * @param total – общее количество продавцов
 * @param seller – объект с данными продавца (содержит profit)
 * @returns {number} размер бонуса в рублях
 */
function calculateBonusByProfit(index, total, seller) {
  const { profit } = seller;
  if (index === 0) {
    return profit * 0.15; // лучший продавец – 15%
  } else if (index === 1 || index === 2) {
    return profit * 0.1; // второе и третье место – 10%
  } else if (index === total - 1) {
    return 0; // последний – без бонуса
  } else {
    return profit * 0.05; // все остальные – 5%
  }
}

/**
 * Основная функция анализа данных о продажах.
 * @param data – объект с коллекциями customers, products, sellers, purchase_records
 * @param options – объект с функциями calculateRevenue и calculateBonus
 * @returns {Array} массив объектов с отчётом по каждому продавцу
 */
function analyzeSalesData(data, options) {
  // 1. Проверка входных данных
  if (
    !data ||
    !Array.isArray(data.sellers) ||
    data.sellers.length === 0 ||
    !Array.isArray(data.products) ||
    data.products.length === 0 ||
    !Array.isArray(data.purchase_records) ||
    data.purchase_records.length === 0
  ) {
    throw new Error("Некорректные входные данные");
  }

  // 2. Проверка опций и наличия необходимых функций
  if (!options || typeof options !== "object") {
    throw new Error("Опции не были переданы или имеют неверный формат");
  }
  const { calculateRevenue, calculateBonus } = options;
  if (!calculateRevenue || typeof calculateRevenue !== "function") {
    throw new Error(
      "Функция расчёта выручки отсутствует или не является функцией",
    );
  }
  if (!calculateBonus || typeof calculateBonus !== "function") {
    throw new Error(
      "Функция расчёта бонусов отсутствует или не является функцией",
    );
  }

  // 3. Подготовка промежуточной структуры для сбора статистики по каждому продавцу
  const sellerStats = data.sellers.map((seller) => ({
    id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,
    profit: 0,
    sales_count: 0,
    products_sold: {}, // ключ – sku, значение – количество
  }));

  // 4. Индексация для быстрого доступа
  const sellerIndex = {};
  sellerStats.forEach((seller) => {
    sellerIndex[seller.id] = seller;
  });

  const productIndex = {};
  data.products.forEach((product) => {
    productIndex[product.sku] = product;
  });

  // 5. Обработка всех чеков и позиций
  data.purchase_records.forEach((record) => {
    const seller = sellerIndex[record.seller_id];
    if (!seller) return; // на всякий случай, если продавец не найден

    // Увеличиваем счётчики продаж и общей выручки (сумма чека уже с учётом скидок)
    seller.sales_count += 1;
    seller.revenue += record.total_amount;

    // Перебираем купленные товары в чеке
    record.items.forEach((item) => {
      const product = productIndex[item.sku];
      if (!product) return; // если товар не найден

      // Себестоимость проданных единиц
      const cost = product.purchase_price * item.quantity;
      // Выручка от этой позиции (с учётом индивидуальной скидки)
      const revenueItem = calculateRevenue(item, product);
      // Прибыль = выручка - себестоимость
      const profitItem = revenueItem - cost;

      seller.profit += profitItem;

      // Учёт проданного количества по артикулу
      if (!seller.products_sold[item.sku]) {
        seller.products_sold[item.sku] = 0;
      }
      seller.products_sold[item.sku] += item.quantity;
    });
  });

  // 6. Сортировка продавцов по убыванию прибыли
  sellerStats.sort((a, b) => b.profit - a.profit);

  // 7. Назначение бонусов и формирование топ-10 товаров для каждого продавца
  sellerStats.forEach((seller, index) => {
    // Бонус рассчитывается на основе позиции в рейтинге и прибыли
    seller.bonus = calculateBonus(index, sellerStats.length, seller);

    // Формируем топ-10 товаров по количеству продаж
    seller.top_products = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  });

  // 8. Финальный отчёт с приведением числовых полей к двум знакам после запятой
  return sellerStats.map((seller) => ({
    seller_id: seller.id,
    name: seller.name,
    revenue: +seller.revenue.toFixed(2),
    profit: +seller.profit.toFixed(2),
    sales_count: seller.sales_count,
    top_products: seller.top_products,
    bonus: +seller.bonus.toFixed(2),
  }));
}
