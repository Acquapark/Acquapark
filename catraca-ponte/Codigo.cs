namespace CatracaPonte;

public static class Codigo
{
    /// <summary>
    /// Os códigos do sistema são numéricos com zeros à esquerda (ex:
    /// 00123456789012). Alguns leitores entregam o número sem esses zeros —
    /// completa até a quantidade configurada para bater com o banco.
    /// </summary>
    public static string Normalizar(string lido, int digitos)
    {
        var codigo = lido.Trim().TrimEnd('\0');
        return codigo.Length > 0 && codigo.Length < digitos && codigo.All(char.IsAsciiDigit)
            ? codigo.PadLeft(digitos, '0')
            : codigo;
    }
}
