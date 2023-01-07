
def lcs(str1, str2):
    """
    Function returns the length of the longest common substring 
    between 2 strings

    :param str1: The first string
    :param str2: The second string
    :return: Length of the longest common substring between str1 and str2.
    """

    a = len(str1)
    b = len(str2)

    # Initalising a 2D array to store longest common substring length
    # between the substrings of str1 and str2
    lcsArray = [[0 for i in range(b+1)] for j in range(a+1)]

    # Variable tracks the current longest length
    result = 0

    # Computing the LCS is a dynamic programming problem
    for m in range(a + 1):
        for n in range(b + 1):
            if (m == 0 or n == 0):
                lcsArray[m][n] = 0
            elif (str1[m-1] == str2[n-1]):
                lcsArray[m][n] = lcsArray[m-1][n-1] + 1
                result = max(result, lcsArray[m][n])
            else:
                lcsArray[m][n] = 0
    return result


def levenshteinDistance(str1, str2):
    """
    Function returns the levenshtein distance between 2 strings

    :param str1: The first string
    :param str2: The second string
    :return: Levenshtein distance between str1 and str2.
    """

    a = len(str1)
    b = len(str2)

    # Initalising a 2D array to store levenshtein distance between the
    # substrings of str1 and str2
    array = [[0 for x in range(a + 1)] for y in range(b + 1)]

    for i in range(0, a + 1):
        array[b][i] = a - i

    for j in range(0, b + 1):
        array[j][a] = b - j

    # Computing the levenshtein is a dynamic programming problem
    for n in range(b - 1, -1, -1):
        for m in range(a - 1, -1, -1):
            if (str1[m] == str2[n]):
                array[n][m] = array[n+1][m+1]
            else:
                array[n][m] = 1 + \
                    min([array[n+1][m], array[n][m+1], array[n+1][m+1]])

    return array[0][0]
